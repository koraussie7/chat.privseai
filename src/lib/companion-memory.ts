/**
 * Companion memory — OpenPerso-inspired hybrid memory, browser-local.
 *
 * Three layers (mirroring OpenPerso's memory.py, simplified for P2P-first):
 *  1. Global facts: cross-companion facts about the user ("name is Yuki", "likes cats")
 *  2. Companion facts: per-companion facts ("met at a cafe", "prefers short replies")
 *  3. Auto-summary: rolling summary once history exceeds SUMMARY_THRESHOLD turns
 *
 * Rules-based extraction first (regex heuristics, zero cost). LLM-assisted
 * extraction can layer on top later via the same `addFact` entrypoint.
 *
 * Storage: localStorage per origin. Never synced to P2P without explicit opt-in.
 */

export interface MemoryFact {
	id: string;
	text: string;
	scope: "global" | "companion";
	companionId?: string;
	source: "rule" | "llm" | "manual";
	createdAt: number;
	lastSeenAt: number;
	hits: number;
}

export interface CompanionMemory {
	facts: MemoryFact[];
	summary: string;
	summaryUpTo: number; // message index the summary covers
}

const STORAGE_KEY = "privsei.memory.v1";
const MAX_FACTS = 120;
const SUMMARY_THRESHOLD = 20; // turns before re-summarizing
const MAX_SUMMARY_CHARS = 900;

type Pattern = { re: RegExp; template: string; noCapture?: boolean };
type Patterns = Pattern[];

/** Rule-based extractors (OpenPerso uses LLM; we start free + instant). */
const USER_PATTERNS: Patterns = [
	{ re: /(?:my name is|i'm|i am|call me)\s+([A-Za-z가-힣]{1,20})\b/i, template: "user's name is {0}" },
	{ re: /i (?:work|working) (?:as|at|in) (?:a |an |the )?([^.!?\n]{2,40})/i, template: "user works as/at {0}" },
	{ re: /i (?:live|am living) in ([^.!?\n]{2,40})/i, template: "user lives in {0}" },
	{ re: /i (?:like|love|enjoy) ([^.!?\n]{2,60})/i, template: "user likes {0}" },
	{ re: /i (?:hate|dislike|can't stand) ([^.!?\n]{2,60})/i, template: "user dislikes {0}" },
	{ re: /i(?:'m| am) (\d{1,2})\s*(?:years old|yo\b)/i, template: "user is {0} years old" },
	{ re: /my (?:birthday) is ([^.!?\n]{2,30})/i, template: "user's birthday is {0}" },
];

const COMPANION_PATTERNS: Patterns = [
	{ re: /(?:please )?(?:always )?(?:call|refer to) me as ([A-Za-z가-힣]{1,20})\b/i, template: "prefers to be called {0}" },
	{ re: /(?:speak|talk|reply) (?:to me )?in (korean|english|japanese|chinese|spanish)/i, template: "prefers replies in {0}" },
	{ re: /don'?t (?:be )?(?:too )?(formal|clingy|bossy|verbose)/i, template: "dislikes being {0}" },
	{ re: /keep (?:it |your replies |responses )?short(?:er)?/i, template: "prefers short replies", noCapture: true },
];

function newId(): string {
	return `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function norm(text: string): string {
	return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Load the whole memory store from localStorage. */
export function loadMemory(): Record<string, CompanionMemory> {
	const ls = typeof globalThis.localStorage !== "undefined" ? globalThis.localStorage : null;
	if (!ls) return {};
	try {
		const raw = ls.getItem(STORAGE_KEY);
		return raw ? (JSON.parse(raw) as Record<string, CompanionMemory>) : {};
	} catch {
		return {};
	}
}

function saveMemory(store: Record<string, CompanionMemory>): void {
	const ls = typeof globalThis.localStorage !== "undefined" ? globalThis.localStorage : null;
	if (!ls) return;
	try {
		ls.setItem(STORAGE_KEY, JSON.stringify(store));
	} catch {
		/* quota — drop silently; memory is best-effort */
	}
}

function getOrCreate(store: Record<string, CompanionMemory>, companionId: string): CompanionMemory {
	if (!store[companionId]) store[companionId] = { facts: [], summary: "", summaryUpTo: 0 };
	return store[companionId];
}

function addFact(
	store: Record<string, CompanionMemory>,
	companionId: string,
	scope: "global" | "companion",
	text: string,
	source: MemoryFact["source"] = "rule",
): void {
	const mem = getOrCreate(store, companionId);
	const key = norm(text);
	const existing = mem.facts.find((f) => norm(f.text) === key && f.scope === scope);
	if (existing) {
		existing.lastSeenAt = Date.now();
		existing.hits += 1;
		return;
	}
	mem.facts.push({
		id: newId(),
		text,
		scope,
		companionId: scope === "companion" ? companionId : undefined,
		source,
		createdAt: Date.now(),
		lastSeenAt: Date.now(),
		hits: 1,
	});
	// Evict least-recently-seen when over budget (global facts first)
	if (mem.facts.length > MAX_FACTS) {
		mem.facts.sort((a, b) => b.lastSeenAt - a.lastSeenAt);
		mem.facts.length = MAX_FACTS;
	}
}

/** Extract facts from a user message using rule heuristics. Cheap, no LLM. */
export function extractFactsFromMessage(companionId: string, message: string): number {
	const store = loadMemory();
	let added = 0;
	for (const p of USER_PATTERNS) {
		const m = message.match(p.re);
		const value = (p as { noCapture?: boolean }).noCapture ? "" : m?.[1];
		if (m && (p as { noCapture?: boolean }).noCapture ? true : Boolean(value && value.length > 1)) {
			addFact(store, companionId, "global", p.template.replace("{0}", value ?? ""));
			added++;
		}
	}
	for (const p of COMPANION_PATTERNS) {
		const m = message.match(p.re);
		const noCap = (p as { noCapture?: boolean }).noCapture === true;
		const value = noCap ? "" : m?.[1];
		if (m && (noCap || Boolean(value && value.length > 1))) {
			addFact(store, companionId, "companion", p.template.replace("{0}", value ?? ""));
			added++;
		}
	}
	if (added > 0) saveMemory(store);
	return added;
}

/** Lightweight keyword-overlap retrieval (replaces pgvector for browser scope). */
export function retrieveRelevantFacts(
	companionId: string,
	query: string,
	limit = 8,
): MemoryFact[] {
	const store = loadMemory();
	const mem = store[companionId];
	if (!mem?.facts.length) return [];
	const qTokens = new Set(norm(query).split(/[^a-z0-9가-힣]+/).filter((t) => t.length > 2));
	const scored = mem.facts.map((f) => {
		const fTokens = norm(f.text).split(/[^a-z0-9가-힣]+/).filter((t) => t.length > 2);
		let overlap = 0;
		for (const t of fTokens) if (qTokens.has(t)) overlap++;
		// recency + usage boost, global facts slightly deprioritized for this companion
		const recencyBoost = Math.max(0, 1 - (Date.now() - f.lastSeenAt) / (1000 * 60 * 60 * 24 * 14));
		const scopeWeight = f.scope === "companion" ? 1.2 : 0.8;
		return { fact: f, overlap, score: overlap * 2 + f.hits * 0.1 + recencyBoost * scopeWeight };
	});
	return scored
		.filter((s) => s.score > 0 && s.overlap > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, limit)
		.map((s) => s.fact);
}

/** All facts for a companion (global + companion-scoped), most relevant first. */
export function getAllFacts(companionId: string): MemoryFact[] {
	const store = loadMemory();
	const global = (store[companionId]?.facts ?? []).filter((f) => f.scope === "global");
	const scoped = (store[companionId]?.facts ?? []).filter((f) => f.scope === "companion");
	return [...scoped, ...global];
}

/**
 * Rolling auto-summary. Called after each message; when unread turns exceed
 * the threshold, folds them into a compressed summary (truncation strategy —
 * an LLM-assisted version can replace `compress` later).
 */
export function maybeSummarize(
	companionId: string,
	messages: Array<{ role: "user" | "assistant"; content: string }>,
): string | null {
	const store = loadMemory();
	const mem = getOrCreate(store, companionId);
	const unread = messages.length - mem.summaryUpTo;
	if (unread < SUMMARY_THRESHOLD) return null;
	const slice = messages.slice(mem.summaryUpTo, messages.length);
	const compress = (role: string, content: string) => {
		const clean = content.replace(/\s+/g, " ").trim();
		return `${role}: ${clean.length > 120 ? `${clean.slice(0, 117)}…` : clean}`;
	};
	const folded = slice.map((m) => compress(m.role === "user" ? "User" : "Companion", m.content)).join("\n");
	const prev = mem.summary ? `${mem.summary}\n…\n` : "";
	mem.summary = (prev + folded).slice(-MAX_SUMMARY_CHARS);
	mem.summaryUpTo = messages.length;
	saveMemory(store);
	return mem.summary;
}

/** Build the memory block to inject into the system prompt. */
export function buildMemoryBlock(companionId: string, currentMessage: string): string {
	const facts = retrieveRelevantFacts(companionId, currentMessage);
	const store = loadMemory();
	const summary = store[companionId]?.summary ?? "";
	const lines: string[] = [];
	if (summary) lines.push(`--- Conversation memory (so far) ---\n${summary}`);
	if (facts.length) {
		lines.push("--- What you remember about the user ---");
		for (const f of facts) lines.push(`- ${f.text}`);
	}
	return lines.join("\n\n");
}

/** Manual fact management (future settings UI). */
export function addManualFact(companionId: string, text: string, scope: "global" | "companion" = "companion"): void {
	const store = loadMemory();
	addFact(store, companionId, scope, text, "manual");
	saveMemory(store);
}

export function deleteFact(companionId: string, factId: string): void {
	const store = loadMemory();
	const mem = store[companionId];
	if (!mem) return;
	mem.facts = mem.facts.filter((f) => f.id !== factId);
	saveMemory(store);
}

export function clearCompanionMemory(companionId: string): void {
	const store = loadMemory();
	delete store[companionId];
	saveMemory(store);
}
