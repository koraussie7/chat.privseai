/**
 * BYOK (Bring Your Own Key) store — per-user AI provider keys.
 *
 * Design:
 * - Keys live ONLY in the user's browser localStorage (`byok_key`).
 *   They are NEVER sent to our servers except as Authorization headers
 *   on direct passthrough calls to the provider (via dev proxy / Caddy
 *   passthrough, which forwards the header untouched).
 * - Backward compatible with the legacy raw-string / {apiKey|key|openai}
 *   shapes already parsed by CandyChatPage / ChatPage.
 */

export type ByokProviderId = "openai" | "anthropic" | "gemini" | "openrouter";

export interface ByokProviderMeta {
  id: ByokProviderId;
  label: string;
  placeholder: string;
  keyUrl: string;
  hint: string;
  prefixHint: string;
}

export const BYOK_PROVIDERS: ByokProviderMeta[] = [
  {
    id: "openai",
    label: "OpenAI",
    placeholder: "sk-...",
    keyUrl: "https://platform.openai.com/account/api-keys",
    hint: "GPT-4o mini / GPT-4o chat",
    prefixHint: "sk-",
  },
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    placeholder: "sk-ant-...",
    keyUrl: "https://console.anthropic.com/settings/keys",
    hint: "Claude 3 Sonnet / Haiku chat",
    prefixHint: "sk-ant-",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    placeholder: "AIza...",
    keyUrl: "https://aistudio.google.com/app/apikey",
    hint: "Gemini chat (OpenAI-compatible endpoint)",
    prefixHint: "AIza",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    placeholder: "sk-or-...",
    keyUrl: "https://openrouter.ai/keys",
    hint: "100+ models incl. free tiers",
    prefixHint: "sk-or-",
  },
];

export type ByokKeys = Partial<Record<ByokProviderId, string>>;

export const BYOK_STORAGE_KEY = "byok_key";

/** Legacy shapes previously written to `byok_key`. */
type LegacyByokShape =
  | string
  | {
      apiKey?: string;
      key?: string;
      openai?: { apiKey?: string } | string;
      anthropic?: { apiKey?: string } | string;
      gemini?: { apiKey?: string } | string;
      openrouter?: { apiKey?: string } | string;
    };

function unwrapKey(value: unknown): string | undefined {
  if (typeof value === "string") {
    const t = value.trim();
    return t ? t : undefined;
  }
  if (value && typeof value === "object") {
    const obj = value as { apiKey?: unknown };
    if (typeof obj.apiKey === "string" && obj.apiKey.trim()) return obj.apiKey.trim();
  }
  return undefined;
}

/** Read all stored provider keys (tolerates every legacy shape). */
export function loadByokKeys(): ByokKeys {
  try {
    const raw = localStorage.getItem(BYOK_STORAGE_KEY);
    if (!raw || !raw.trim()) return {};
    const trimmed = raw.trim();
    // Legacy: raw key string → treat as OpenAI key.
    if (!trimmed.startsWith("{")) return { openai: trimmed };
    const parsed = JSON.parse(trimmed) as LegacyByokShape;
    if (typeof parsed === "string") {
      return parsed.trim() ? { openai: parsed.trim() } : {};
    }
    const out: ByokKeys = {};
    const openai = unwrapKey(parsed.openai) ?? unwrapKey(parsed.apiKey) ?? unwrapKey(parsed.key);
    if (openai) out.openai = openai;
    const anthropic = unwrapKey((parsed as Record<string, unknown>).anthropic);
    if (anthropic) out.anthropic = anthropic;
    const gemini = unwrapKey((parsed as Record<string, unknown>).gemini);
    if (gemini) out.gemini = gemini;
    const openrouter = unwrapKey((parsed as Record<string, unknown>).openrouter);
    if (openrouter) out.openrouter = openrouter;
    return out;
  } catch {
    return {};
  }
}

/** Persist provider keys (drops empty entries; removes item when empty). */
export function saveByokKeys(keys: ByokKeys): void {
  const clean: ByokKeys = {};
  (Object.keys(keys) as ByokProviderId[]).forEach((id) => {
    const v = keys[id]?.trim();
    if (v) clean[id] = v;
  });
  if (Object.keys(clean).length === 0) {
    localStorage.removeItem(BYOK_STORAGE_KEY);
    return;
  }
  // Canonical shape: { openai: {apiKey}, anthropic: {apiKey}, ... }
  // — also readable by the legacy parsers in chat pages.
  const canonical: Record<string, { apiKey: string }> = {};
  (Object.keys(clean) as ByokProviderId[]).forEach((id) => {
    canonical[id] = { apiKey: clean[id] as string };
  });
  localStorage.setItem(BYOK_STORAGE_KEY, JSON.stringify(canonical));
}

/** Get the key for a single provider. */
export function getByokKey(provider: ByokProviderId): string | undefined {
  return loadByokKeys()[provider];
}

/** Set (or clear with empty string) one provider key. */
export function setByokKey(provider: ByokProviderId, key: string): ByokKeys {
  const next = { ...loadByokKeys() };
  const t = key.trim();
  if (t) next[provider] = t;
  else delete next[provider];
  saveByokKeys(next);
  return loadByokKeys();
}

/** Providers that currently have a key stored. */
export function byokProvidersReady(): ByokProviderId[] {
  const keys = loadByokKeys();
  return (Object.keys(keys) as ByokProviderId[]).filter((id) => !!keys[id]);
}

/** Mask a key for display: `sk-...1234`. */
export function maskKey(key: string): string {
  const t = key.trim();
  if (t.length <= 8) return "••••";
  return `${t.slice(0, 3)}...${t.slice(-4)}`;
}
