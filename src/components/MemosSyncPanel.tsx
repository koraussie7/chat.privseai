/**
 * MemosSyncPanel — settings UI to sync companion memory with a my-neuro
 * "Memos" server (Embedding/Rerank API).
 *
 * Reads/writes the same localStorage memory store as companion-memory.ts so
 * syncing is non-destructive: remote records are merged (dedup by id and
 * content), local-only records are pushed.
 */
import { useState } from "react";
import {
	syncWithMemos,
	MemoryBridgeError,
	type MemosConfig,
} from "@/lib/integration/MemoryBridge";
import { getAllFacts, type MemoryFact } from "@/lib/companion-memory";
import type { MemoryEntry } from "@/types/unified";

const CONFIG_KEY = "privsei.memos.config";

function loadConfig(): MemosConfig | null {
	try {
		const raw = localStorage.getItem(CONFIG_KEY);
		return raw ? (JSON.parse(raw) as MemosConfig) : null;
	} catch {
		return null;
	}
}

/** Convert the localStorage fact model into the MemoryEntry shape the bridge uses. */
function factsToEntries(facts: MemoryFact[]): MemoryEntry[] {
	return facts.map((f) => ({
		id: f.id,
		type: "fact",
		content: f.text,
		importance: Math.min(10, f.hits),
		tags: [f.scope],
		createdAt: f.createdAt,
		lastAccessedAt: f.lastSeenAt,
		accessCount: f.hits,
		source: "inferred",
		relatedCompanionId: f.companionId,
	}));
}

interface Props {
	/** The companion whose memory should sync. */
	companionId?: string;
}

export function MemosSyncPanel({ companionId }: Props) {
	const saved = loadConfig();
	const [endpoint, setEndpoint] = useState(saved?.endpoint ?? "http://127.0.0.1:8081");
	const [token, setToken] = useState(saved?.token ?? "");
	const [namespace, setNamespace] = useState(saved?.namespace ?? companionId ?? "default");
	const [busy, setBusy] = useState(false);
	const [status, setStatus] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

	const saveConfig = () => {
		localStorage.setItem(CONFIG_KEY, JSON.stringify({ endpoint, token, namespace }));
		setStatus({ kind: "ok", text: "Connection settings saved." });
	};

	const handleSync = async () => {
		setBusy(true);
		setStatus(null);
		try {
			const config: MemosConfig = { endpoint, token: token || undefined, namespace };
			localStorage.setItem(CONFIG_KEY, JSON.stringify(config));

			const local = factsToEntries(getAllFacts(companionId ?? "default"));
			const { merged, added, pushed } = await syncWithMemos(config, local);

			// Persist the merged facts back to the local store (append-only).
			const store = JSON.parse(localStorage.getItem("privsei.memory.v1") ?? "{}") as Record<
				string,
				{ facts: MemoryFact[]; summary: string; summaryUpTo: number }
			>;
			const key = companionId ?? "default";
			const mem = store[key] ?? { facts: [], summary: "", summaryUpTo: 0 };
			const known = new Set(mem.facts.map((f) => f.id));
			for (const entry of merged) {
				if (known.has(entry.id)) continue;
				mem.facts.push({
					id: entry.id,
					text: entry.content,
					scope: entry.relatedCompanionId ? "companion" : "global",
					companionId: entry.relatedCompanionId,
					source: "manual",
					createdAt: entry.createdAt,
					lastSeenAt: entry.createdAt,
					hits: 1,
				});
			}
			store[key] = mem;
			localStorage.setItem("privsei.memory.v1", JSON.stringify(store));

			setStatus({
				kind: "ok",
				text: `Synced: +${added} from server, ↑${pushed} pushed.`,
			});
		} catch (error) {
			const message =
				error instanceof MemoryBridgeError
					? `${error.code}: ${error.message}`
					: error instanceof Error
						? error.message
						: "Sync failed";
			setStatus({ kind: "err", text: message });
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="bg-[#12141e] border border-white/10 rounded-3xl p-6">
			<h2 className="text-lg font-bold text-white mb-1">Memory Sync (Memos)</h2>
			<p className="text-sm text-gray-400 mb-4">
				Two-way sync with a my-neuro Memos server so long-term memory follows
				you between the web app and the desktop companion.
			</p>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<div className="sm:col-span-2">
					<label htmlFor="memos-endpoint" className="block text-sm font-medium text-gray-300 mb-2">
						Server URL
					</label>
					<input
						id="memos-endpoint"
						type="url"
						value={endpoint}
						onChange={(e) => setEndpoint(e.target.value)}
						placeholder="http://127.0.0.1:8081"
						className="w-full px-4 py-2.5 bg-[#0e0f17] border border-white/10 rounded-2xl text-gray-100 focus:outline-none focus:border-pink-500/50 transition-colors"
					/>
				</div>
				<div>
					<label htmlFor="memos-namespace" className="block text-sm font-medium text-gray-300 mb-2">
						Namespace
					</label>
					<input
						id="memos-namespace"
						type="text"
						value={namespace}
						onChange={(e) => setNamespace(e.target.value)}
						className="w-full px-4 py-2.5 bg-[#0e0f17] border border-white/10 rounded-2xl text-gray-100 focus:outline-none focus:border-pink-500/50 transition-colors"
					/>
				</div>
				<div>
					<label htmlFor="memos-token" className="block text-sm font-medium text-gray-300 mb-2">
						API Token (optional)
					</label>
					<input
						id="memos-token"
						type="password"
						value={token}
						onChange={(e) => setToken(e.target.value)}
						placeholder="Optional bearer token"
						className="w-full px-4 py-2.5 bg-[#0e0f17] border border-white/10 rounded-2xl text-gray-100 focus:outline-none focus:border-pink-500/50 transition-colors"
					/>
				</div>
			</div>

			<div className="mt-4 flex flex-wrap gap-3">
				<button
					type="button"
					onClick={handleSync}
					disabled={busy}
					className="px-4 py-2.5 rounded-2xl bg-candy-gradient text-white font-semibold text-sm hover:bg-candy-gradient-hover transition disabled:opacity-50"
				>
					{busy ? "Syncing…" : "↻ Sync now"}
				</button>
				<button
					type="button"
					onClick={saveConfig}
					className="px-4 py-2.5 rounded-2xl bg-[#0e0f17] border border-white/10 text-gray-100 font-semibold text-sm hover:border-white/20 transition"
				>
					Save settings
				</button>
			</div>

			{status && (
				<div
					role="status"
					className={`mt-4 p-3 rounded-xl text-sm border ${
						status.kind === "ok"
							? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
							: "bg-rose-500/10 border-rose-500/30 text-rose-300"
					}`}
				>
					{status.text}
				</div>
			)}
		</div>
	);
}
