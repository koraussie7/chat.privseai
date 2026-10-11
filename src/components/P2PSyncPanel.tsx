/**
 * P2PSyncPanel — multi-device companion state sync.
 *
 * Surfaces `P2PMemorySync` (Yjs CRDT over WebRTC) which had no UI at all: the
 * class was complete but the `useP2PSync` hook it shipped was a stub that
 * called `new` on an interface, so nothing ever connected.
 *
 * What this panel shows:
 *  - live connectivity and peer count (polled — Yjs emits no disconnect event)
 *  - CRDT sync state (status, last synced, pending changes, conflict count)
 *  - manual "Sync now"
 *
 * It deliberately does not fabricate activity: with no peers connected the
 * honest read is "offline, waiting for another device".
 */
import { useState } from "react";
import { useP2PSync } from "@/lib/sync/P2PMemorySync";
import type { SyncOperation } from "@/types/unified";

interface Props {
  companionId: string;
}

function relativeTime(ts: number): string {
  if (!ts) return "never";
  const secs = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  return `${Math.round(secs / 3600)}h ago`;
}

export function P2PSyncPanel({ companionId }: Props) {
  const [conflicts, setConflicts] = useState<SyncOperation[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    syncState,
    peerCount,
    online,
    ready,
    forceSync,
  } = useP2PSync(
    companionId,
    undefined,
    {
      onConflict: (ops) => setConflicts(ops),
      onError: (err) => setError(err.message),
    },
  );

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      await forceSync();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-[#0e1018] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-white">Multi-device sync</h3>
          <p className="mt-1 max-w-prose text-sm text-slate-400">
            Character memory, relationship progress and gallery merge across your
            devices with a CRDT, so edits made offline reconcile instead of
            overwriting each other. No server sees your data.
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${
            online
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
              : "border-amber-400/30 bg-amber-400/10 text-amber-200"
          }`}
        >
          {!ready ? "Starting…" : online ? "Connected" : "No peers"}
        </span>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-3">
          <dt className="text-xs text-slate-500">Paired devices</dt>
          <dd className="mt-1 text-2xl font-bold text-white">{peerCount}</dd>
        </div>
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-3">
          <dt className="text-xs text-slate-500">Pending changes</dt>
          <dd className="mt-1 text-2xl font-bold text-white">
            {syncState?.pendingChanges ?? 0}
          </dd>
        </div>
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-3">
          <dt className="text-xs text-slate-500">Conflicts resolved</dt>
          <dd className="mt-1 text-2xl font-bold text-white">
            {syncState?.conflictCount ?? 0}
          </dd>
        </div>
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-3">
          <dt className="text-xs text-slate-500">Last synced</dt>
          <dd className="mt-1 text-lg font-bold text-white">
            {relativeTime(syncState?.lastSyncedAt ?? 0)}
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing || !ready}
          className="rounded-full bg-fuchsia-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {syncing ? "Syncing…" : "Sync now"}
        </button>
        <p className="text-xs text-slate-500">
          Open this page on a second device and both peers find each other
          automatically.
        </p>
      </div>

      {peerCount === 0 && ready && (
        <p className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-200">
          No other device is connected right now. Your edits are saved locally and
          will merge as soon as a second device joins.
        </p>
      )}

      {conflicts.length > 0 && (
        <p className="mt-4 rounded-2xl border border-sky-400/20 bg-sky-400/5 p-3 text-xs text-sky-200">
          {conflicts.length} concurrent edit{conflicts.length === 1 ? "" : "s"} were
          merged automatically — CRDT keeps every change.
        </p>
      )}

      {(error ?? syncState?.error) && (
        <p className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/5 p-3 text-xs text-rose-200">
          {error ?? syncState?.error}
        </p>
      )}

      <p className="mt-4 font-mono text-[11px] text-slate-600">
        room: companion-sync-{companionId}
      </p>
    </div>
  );
}
