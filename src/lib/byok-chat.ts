/**
 * BYOK chat transport — sends chat completions with the USER's own key.
 *
 * Flow: browser -> same-origin /api/byok/<provider>/* (dev proxy or Caddy
 * passthrough, which forwards the Authorization header untouched) ->
 * provider upstream. Our servers never store the key.
 */

import { API_URL } from "@/lib/config";
import { loadByokKeys, type ByokProviderId } from "@/lib/byok-store";

export interface ByokChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const PROVIDER_MODEL: Record<ByokProviderId, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-haiku-20240307",
  gemini: "gemini-1.5-flash",
  openrouter: "openai/gpt-4o-mini",
};

const PROVIDER_PATH: Record<ByokProviderId, string> = {
  openai: "/v1/chat/completions",
  anthropic: "/v1/messages",
  gemini: "/v1beta/openai/chat/completions",
  openrouter: "/api/v1/chat/completions",
};

/** First provider (in UI order) that has a stored key, or null. */
export function firstByokProvider(): ByokProviderId | null {
  const keys = loadByokKeys();
  const order: ByokProviderId[] = ["openai", "anthropic", "gemini", "openrouter"];
  for (const id of order) {
    if (keys[id]) return id;
  }
  return null;
}

function buildBody(
  provider: ByokProviderId,
  messages: ByokChatMessage[],
  opts: { temperature?: number; maxTokens?: number },
): Record<string, unknown> {
  const temperature = opts.temperature ?? 0.7;
  const maxTokens = opts.maxTokens ?? 512;
  if (provider === "anthropic") {
    const systemMsg = messages.find((m) => m.role === "system");
    const rest = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));
    return {
      model: PROVIDER_MODEL.anthropic,
      system: systemMsg?.content,
      messages: rest,
      max_tokens: maxTokens,
      temperature,
      stream: false,
    };
  }
  return {
    model: PROVIDER_MODEL[provider],
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    temperature,
    max_tokens: maxTokens,
    stream: false,
  };
}

function extractReply(provider: ByokProviderId, data: unknown): string | undefined {
  if (provider === "anthropic") {
    const blocks = (data as { content?: Array<{ text?: string }> }).content;
    return blocks?.[0]?.text;
  }
  return (data as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message
    ?.content;
}

/**
 * Try one BYOK chat round-trip. Returns the reply text, or null when no key
 * is stored for the provider or the request fails (caller falls through).
 */
export async function tryByokChat(
  text: string,
  systemPrompt: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  provider?: ByokProviderId,
): Promise<{ reply: string; provider: ByokProviderId } | null> {
  const keys = loadByokKeys();
  const chosen = provider ?? firstByokProvider();
  if (!chosen) return null;
  const apiKey = keys[chosen];
  if (!apiKey) return null;

  const order: ByokProviderId[] = ["openai", "anthropic", "gemini", "openrouter"];
  const candidates = provider
    ? [provider]
    : [chosen, ...order.filter((p) => p !== chosen && keys[p])];

  for (const pid of candidates) {
    const key = keys[pid];
    if (!key) continue;
    try {
      const messages: ByokChatMessage[] = [
        { role: "system", content: systemPrompt },
        ...history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
        { role: "user", content: text },
      ];
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      };
      if (pid === "anthropic") headers["anthropic-version"] = "2023-06-01";
      if (pid === "openrouter") {
        headers["HTTP-Referer"] = window.location.origin;
        headers["X-Title"] = "PrivseAI";
      }
      // Same-origin /api/byok/<provider>/* — dev proxy or Caddy passthrough
      // forwards the Authorization header untouched to the provider.
      // API_URL is the site origin in prod (relative-safe), so strip to path.
      const base = API_URL.startsWith("http") ? "" : API_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/byok/${pid}${PROVIDER_PATH[pid]}`, {
        method: "POST",
        headers,
        body: JSON.stringify(buildBody(pid, messages, {})),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) continue;
      let data: unknown;
      try {
        data = await res.json();
      } catch {
        continue;
      }
      const reply = extractReply(pid, data);
      if (reply) return { reply, provider: pid };
    } catch {
      continue;
    }
  }
  return null;
}
