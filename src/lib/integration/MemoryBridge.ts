/**
 * MemoryBridge — exchange long-term companion memory between PrivseAI's local
 * store (companion-memory.ts) and a my-neuro "Memos" server
 * (Embedding / Rerank API), so memories gathered on the desktop app appear in
 * the web app and vice-versa.
 *
 * Scope of this bridge:
 *  - convert PrivseAI MemoryEntry <-> Memos memory records
 *  - push / pull over HTTP against a user-run Memos endpoint
 *  - merge without duplicating (id- and content-hash based)
 *
 * It deliberately does NOT own persistence or P2P sync — P2PMemorySync (Yjs)
 * stays the source of truth on the web side; this is an adapter on top of it.
 */

import type { MemoryEntry } from "@/types/unified";

export interface MemosConfig {
	/** Base URL of the Memos server, e.g. http://127.0.0.1:8081 */
	endpoint: string;
	/** API token if the server requires one */
	token?: string;
	/** namespace / user id on the Memos side */
	namespace: string;
	timeoutMs?: number;
}

/** A memory record as Memos stores it. */
export interface MemosRecord {
	id: string;
	content: string;
	/** ISO-8601 creation time */
	createdAt: string;
	tags?: string[];
	/** server-side namespace/user */
	creator?: string;
	[key: string]: unknown;
}

export class MemoryBridgeError extends Error {
	code: "not-configured" | "network" | "provider-error" | "conflict";
	constructor(code: MemoryBridgeError["code"], message: string) {
		super(message);
		this.name = "MemoryBridgeError";
		this.code = code;
	}
}

const DEFAULT_TIMEOUT = 20_000;

/** Stable content hash so the same memory isn't pushed twice. */
export function memoryFingerprint(
	entry: Pick<MemoryEntry, "content"> & { type?: MemoryEntry["type"] },
): string {
	const text = `${entry.type ?? "memory"}:${entry.content ?? ""}`;
	let hash = 0;
	for (let i = 0; i < text.length; i++) {
		hash = (hash * 31 + text.charCodeAt(i)) | 0;
	}
	return `m${(hash >>> 0).toString(36)}`;
}

/** PrivseAI MemoryEntry → Memos record. */
export function toMemosRecord(
	entry: MemoryEntry,
	namespace: string,
): MemosRecord {
	return {
		id: entry.id,
		content: entry.content,
		createdAt: new Date(entry.createdAt ?? Date.now()).toISOString(),
		tags: ["privseai", `type:${entry.type}`, ...(entry.tags ?? [])],
		creator: namespace,
		privseai: {
			type: entry.type,
			importance: entry.importance,
			source: entry.source,
			relatedCompanionId: entry.relatedCompanionId,
		},
	};
}

/** Memos record → PrivseAI MemoryEntry. */
export function fromMemosRecord(record: MemosRecord): MemoryEntry {
	const priv = (record.privseai ?? {}) as Record<string, unknown>;
	const created = Date.parse(record.createdAt) || Date.now();
	return {
		id: record.id,
		type: (priv.type as MemoryEntry["type"]) ?? "fact",
		content: record.content,
		importance: typeof priv.importance === "number" ? priv.importance : 1,
		tags: record.tags ?? [],
		createdAt: created,
		lastAccessedAt: created,
		accessCount: 0,
		source: (priv.source as MemoryEntry["source"]) ?? "system",
		relatedCompanionId:
			typeof priv.relatedCompanionId === "string" ? priv.relatedCompanionId : undefined,
	};
}

/**
 * Merge remote records into local entries without duplicates.
 * Local entries win on conflict (they are the source of truth for the device).
 */
export function mergeMemories(
	local: MemoryEntry[],
	remote: MemosRecord[],
): { merged: MemoryEntry[]; added: number; skipped: number } {
	const seen = new Set(local.map((e) => memoryFingerprint(e)));
	const ids = new Set(local.map((e) => e.id));
	const merged = [...local];
	let added = 0;
	let skipped = 0;

	for (const record of remote) {
		const entry = fromMemosRecord(record);
		const fingerprint = memoryFingerprint(entry);
		if (ids.has(entry.id) || seen.has(fingerprint)) {
			skipped++;
			continue;
		}
		seen.add(fingerprint);
		ids.add(entry.id);
		merged.push(entry);
		added++;
	}
	merged.sort((a, b) => a.createdAt - b.createdAt);
	return { merged, added, skipped };
}

function authHeaders(config: MemosConfig): HeadersInit {
	const headers: Record<string, string> = { "Content-Type": "application/json" };
	if (config.token) headers.Authorization = `Bearer ${config.token}`;
	return headers;
}

function requireEndpoint(config: MemosConfig): string {
	const raw = (config.endpoint ?? "").trim().replace(/[/]+$/, "");
	if (!/^https?:\/\//i.test(raw)) {
		throw new MemoryBridgeError(
			"not-configured",
			"Memos endpoint must start with http:// or https://",
		);
	}
	return raw;
}

/** Pull all memory records for a namespace from the Memos server. */
export async function pullMemos(
	config: MemosConfig,
	fetchImpl: typeof fetch = fetch,
): Promise<MemosRecord[]> {
	const base = requireEndpoint(config);
	try {
		const response = await fetchImpl(
			`${base}/api/v1/memos?creator=${encodeURIComponent(config.namespace)}`,
			{
				method: "GET",
				headers: authHeaders(config),
				signal: AbortSignal.timeout(config.timeoutMs ?? DEFAULT_TIMEOUT),
			},
		);
		if (!response.ok) {
			throw new MemoryBridgeError(
				"provider-error",
				`Memos returned HTTP ${response.status}`,
			);
		}
		const data = (await response.json()) as { memos?: MemosRecord[] } | MemosRecord[];
		return Array.isArray(data) ? data : (data.memos ?? []);
	} catch (error) {
		if (error instanceof MemoryBridgeError) throw error;
		throw new MemoryBridgeError(
			"network",
			error instanceof Error ? error.message : "Memos pull failed",
		);
	}
}

/** Push entries that aren't already present remotely. */
export async function pushMemos(
	config: MemosConfig,
	entries: MemoryEntry[],
	fetchImpl: typeof fetch = fetch,
): Promise<{ pushed: number; skipped: number }> {
	const base = requireEndpoint(config);
	let pushed = 0;
	let skipped = 0;

	const remote = await pullMemos(config, fetchImpl).catch(() => [] as MemosRecord[]);
	const existing = new Set(remote.map((r) => memoryFingerprint(fromMemosRecord(r))));

	for (const entry of entries) {
		if (existing.has(memoryFingerprint(entry))) {
			skipped++;
			continue;
		}
		const record = toMemosRecord(entry, config.namespace);
		try {
			const response = await fetchImpl(`${base}/api/v1/memos`, {
				method: "POST",
				headers: authHeaders(config),
				body: JSON.stringify({ content: record.content, tags: record.tags, creator: config.namespace }),
			});
			if (!response.ok) {
				skipped++;
				continue;
			}
			existing.add(memoryFingerprint(entry));
			pushed++;
		} catch {
			skipped++;
		}
	}
	return { pushed, skipped };
}

/**
 * Full two-way reconcile for a namespace: pull remote, merge into local, then
 * push anything local-only. Returns the merged list for the caller to persist
 * via P2PMemorySync.
 */
export async function syncWithMemos(
	config: MemosConfig,
	local: MemoryEntry[],
	fetchImpl: typeof fetch = fetch,
): Promise<{ merged: MemoryEntry[]; added: number; pushed: number }> {
	const remote = await pullMemos(config, fetchImpl);
	const { merged, added } = mergeMemories(local, remote);
	const { pushed } = await pushMemos(config, merged, fetchImpl);
	return { merged, added, pushed };
}

/** Read a my-neuro memory config into a MemosConfig for this bridge. */
export function configForMyNeuro(profile: {
	name: string;
	memory?: { namespace?: string };
}, endpoint: string, token?: string): MemosConfig {
	return {
		endpoint,
		token,
		namespace:
			profile.memory?.namespace ||
			profile.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
	};
}
