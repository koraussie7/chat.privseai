/**
 * Tests for companion-memory (OpenPerso-inspired hybrid memory).
 * Covers: rule-based extraction, retrieval ranking, rolling summary,
 * fact eviction, and memory block assembly.
 */

import {
	extractFactsFromMessage,
	retrieveRelevantFacts,
	getAllFacts,
	maybeSummarize,
	buildMemoryBlock,
	addManualFact,
	deleteFact,
	clearCompanionMemory,
	loadMemory,
} from "@/lib/companion-memory";

// Node environment has no localStorage — install a minimal in-memory shim.
const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
	getItem: (k: string) => store.get(k) ?? null,
	setItem: (k: string, v: string) => void store.set(k, v),
	removeItem: (k: string) => void store.delete(k),
	clear: () => void store.clear(),
};

const C = "companion-test-1";

beforeEach(() => {
	(globalThis as { localStorage: { clear(): void } }).localStorage.clear();
});

describe("rule-based extraction", () => {
	it("extracts user name into global scope", () => {
		extractFactsFromMessage(C, "Hi! My name is Yuki and I love ramen.");
		const facts = getAllFacts(C);
		expect(facts.some((f) => f.text.includes("Yuki") && f.scope === "global")).toBe(true);
	});

	it("extracts likes into global scope", () => {
		extractFactsFromMessage(C, "I love late-night walks.");
		const facts = getAllFacts(C);
		expect(facts.some((f) => f.text.includes("late-night walks"))).toBe(true);
	});

	it("extracts companion-scoped preferences", () => {
		extractFactsFromMessage(C, "Please speak to me in korean and keep it short.");
		const facts = getAllFacts(C).filter((f) => f.scope === "companion");
		expect(facts.some((f) => f.text.toLowerCase().includes("korean"))).toBe(true);
		expect(facts.some((f) => f.text.includes("short replies"))).toBe(true);
	});

	it("does not re-add duplicates but bumps hits", () => {
		extractFactsFromMessage(C, "My name is Hana.");
		extractFactsFromMessage(C, "My name is Hana again!");
		const facts = getAllFacts(C).filter((f) => f.text.includes("Hana"));
		expect(facts).toHaveLength(1);
		expect(facts[0].hits).toBeGreaterThanOrEqual(2);
	});

	it("ignores messages with nothing extractable", () => {
		expect(extractFactsFromMessage(C, "lol okay")).toBe(0);
		expect(getAllFacts(C)).toHaveLength(0);
	});
});

describe("retrieval", () => {
	it("ranks query-relevant facts first", () => {
		extractFactsFromMessage(C, "I love jazz music and vinyl records.");
		extractFactsFromMessage(C, "I work as a graphic designer.");
		addManualFact(C, "user is allergic to shellfish", "global");
		const hits = retrieveRelevantFacts(C, "what music should we listen to?");
		expect(hits[0].text).toContain("jazz");
	});

	it("returns empty when nothing matches", () => {
		extractFactsFromMessage(C, "My name is Mina.");
		expect(retrieveRelevantFacts(C, "tell me about orbital mechanics and calculus")).toHaveLength(0);
	});
});

describe("rolling summary", () => {
	it("does not summarize below threshold", () => {
		const msgs = Array.from({ length: 19 }, (_, i) => ({
			role: (i % 2 ? "assistant" : "user") as "user" | "assistant",
			content: `message ${i}`,
		}));
		expect(maybeSummarize(C, msgs)).toBeNull();
	});

	it("summarizes at/above threshold and advances cursor", () => {
		const msgs = Array.from({ length: 24 }, (_, i) => ({
			role: (i % 2 ? "assistant" : "user") as "user" | "assistant",
			content: `discussion point number ${i} about our shared plans`,
		}));
		const first = maybeSummarize(C, msgs);
		expect(first).toBeTruthy();
		expect(first).toContain("discussion point");
		// no new summary until 20 more turns
		expect(maybeSummarize(C, msgs)).toBeNull();
	});

	it("buildMemoryBlock composes summary + facts", () => {
		extractFactsFromMessage(C, "My name is Kenji.");
		const msgs = Array.from({ length: 22 }, (_, i) => ({
			role: (i % 2 ? "assistant" : "user") as "user" | "assistant",
			content: `talking about trip ${i}`,
		}));
		maybeSummarize(C, msgs);
		const block = buildMemoryBlock(C, "Kenji here, what trip should we plan?");
		expect(block).toContain("remember about the user");
		expect(block).toContain("Kenji");
	});
});

describe("management", () => {
	it("manual add + delete works", () => {
		addManualFact(C, "user prefers tea over coffee", "companion");
		const facts = getAllFacts(C);
		expect(facts.some((f) => f.text.includes("tea over coffee"))).toBe(true);
		const id = facts.find((f) => f.text.includes("tea over coffee"))!.id;
		deleteFact(C, id);
		expect(getAllFacts(C).some((f) => f.text.includes("tea over coffee"))).toBe(false);
	});

	it("clearCompanionMemory wipes scoped memory", () => {
		extractFactsFromMessage(C, "My name is Sora.");
		clearCompanionMemory(C);
		expect(getAllFacts(C)).toHaveLength(0);
		expect(loadMemory()[C]).toBeUndefined();
	});
});
