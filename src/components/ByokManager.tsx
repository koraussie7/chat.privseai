import { useMemo, useState } from "react";
import {
  BYOK_PROVIDERS,
  byokProvidersReady,
  getByokKey,
  loadByokKeys,
  maskKey,
  setByokKey,
  type ByokProviderId,
} from "@/lib/byok-store";

interface Props {
  compact?: boolean;
  onKeysChange?: (ready: ByokProviderId[]) => void;
}

/**
 * BYOK Manager — lets each user attach their own AI provider keys.
 * Keys are stored in localStorage only, never sent to our servers.
 */
export function ByokManager({ compact = false, onKeysChange }: Props) {
  const [editing, setEditing] = useState<ByokProviderId | null>(null);
  const [draft, setDraft] = useState("");
  const [forceConfirm, setForceConfirm] = useState(false);
  const [saved, setSaved] = useState<Record<string, string>>(() => {
    const keys = loadByokKeys();
    const out: Record<string, string> = {};
    (Object.keys(keys) as ByokProviderId[]).forEach((id) => {
      if (keys[id]) out[id] = maskKey(keys[id] as string);
    });
    return out;
  });

  const ready = useMemo(() => byokProvidersReady(), [saved]);

  const startEdit = (id: ByokProviderId) => {
    setEditing(id);
    setDraft(getByokKey(id) ?? "");
    setForceConfirm(false);
  };

  const cancelEdit = () => {
    setEditing(null);
    setDraft("");
    setForceConfirm(false);
  };

  const refreshSaved = () => {
    const next = loadByokKeys();
    const out: Record<string, string> = {};
    (Object.keys(next) as ByokProviderId[]).forEach((pid) => {
      if (next[pid]) out[pid] = maskKey(next[pid] as string);
    });
    setSaved(out);
    onKeysChange?.(byokProvidersReady());
  };

  const saveKey = (id: ByokProviderId) => {
    const meta = BYOK_PROVIDERS.find((p) => p.id === id);
    const t = draft.trim();
    if (t && meta && !t.startsWith(meta.prefixHint) && !forceConfirm) {
      setForceConfirm(true);
      return;
    }
    setByokKey(id, t);
    refreshSaved();
    setEditing(null);
    setDraft("");
    setForceConfirm(false);
  };

  const removeKey = (id: ByokProviderId) => {
    if (!confirm(`Remove your ${id} key from this browser?`)) return;
    setByokKey(id, "");
    refreshSaved();
    setEditing(null);
    setDraft("");
    setForceConfirm(false);
  };

  return (
    <div className={compact ? "" : "bg-[#12141e] border border-white/10 rounded-3xl p-6"}>
      {!compact && (
        <>
          <h2 className="text-lg font-bold text-white mb-1">🔑 My AI Keys (BYOK)</h2>
          <p className="text-xs text-gray-400 mb-4">
            Use your own AI account for chat. Keys stay in this browser only — they are never
            stored on our servers. Add at least one key to chat with real AI.
          </p>
        </>
      )}

      {ready.length > 0 && (
        <div className="mb-3 text-xs text-emerald-300">
          ✅ {ready.length} key{ready.length > 1 ? "s" : ""} ready: {ready.join(", ")}
        </div>
      )}

      <div className="space-y-3">
        {BYOK_PROVIDERS.map((meta) => {
          const masked = saved[meta.id];
          const isEditing = editing === meta.id;
          return (
            <div key={meta.id} className="p-3 rounded-xl bg-[#0e0f17] border border-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-100">{meta.label}</div>
                  <div className="text-[11px] text-gray-500">{meta.hint}</div>
                </div>
                {masked && !isEditing ? (
                  <span className="text-xs font-mono text-emerald-300/90">{masked}</span>
                ) : null}
                {!masked && !isEditing ? (
                  <span className="text-[11px] text-gray-500">not set</span>
                ) : null}
              </div>

              {isEditing ? (
                <div className="mt-3 space-y-2">
                  <input
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      setForceConfirm(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveKey(meta.id);
                      if (e.key === "Escape") cancelEdit();
                    }}
                    placeholder={meta.placeholder}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm font-mono text-gray-100 focus:outline-none focus:border-pink-500/50"
                  />
                  {forceConfirm && (
                    <div className="text-[11px] text-amber-300">
                      This doesn&apos;t look like a {meta.label} key. Press Save again to confirm.
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => saveKey(meta.id)}
                      className="px-3 py-1.5 rounded-xl bg-candy-gradient text-white text-xs font-semibold hover:bg-candy-gradient-hover transition"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="px-3 py-1.5 rounded-xl bg-white/5 text-gray-300 text-xs hover:text-white transition"
                    >
                      Cancel
                    </button>
                    <a
                      href={meta.keyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto text-[11px] text-pink-300/80 hover:text-pink-200 underline"
                    >
                      Get a key →
                    </a>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(meta.id)}
                    className="px-3 py-1.5 rounded-xl bg-white/5 text-gray-200 text-xs hover:bg-white/10 transition"
                  >
                    {masked ? "Change" : "Add key"}
                  </button>
                  {masked ? (
                    <button
                      type="button"
                      onClick={() => removeKey(meta.id)}
                      className="px-3 py-1.5 rounded-xl bg-white/5 text-rose-300/80 text-xs hover:bg-rose-500/10 transition"
                    >
                      Remove
                    </button>
                  ) : (
                    <a
                      href={meta.keyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto text-[11px] text-pink-300/80 hover:text-pink-200 underline"
                    >
                      Get a key →
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!compact && (
        <p className="mt-4 text-[11px] leading-relaxed text-gray-500">
          How it works: your chat request goes straight to the provider you chose, using your key
          in the request header. Our servers never see or store your key — they only forward the
          request so your browser avoids CORS blocks.
        </p>
      )}
    </div>
  );
}

