/**
 * bitterbot-bridge.ts — PrivseAI ↔ bitterbot desktop bridge (synergy.md 2단계).
 *
 * Architecture (mirrors telegram-relay.ts conventions):
 *
 *   PrivseAI web chat  ──(Trystero/WebRTC)──►  privseai web client
 *        │                                          │
 *        │ same conversation is ALSO mirrored to    │ HTTP (OpenAI-compatible)
 *        │ the user's own desktop agent over        ▼
 *        │ the gateway's /v1/chat/completions  bitterbot gateway (localhost:19091)
 *        ▼                                          │
 *   Telegram users  ◄──────── bridge replies ───────┘
 *   (via the user's bitterbot Telegram channel —
 *    the companion identity answers there too)
 *
 * Design invariants (synergy.md preconditions):
 *  - Local-first: the bridge only talks to the user's OWN gateway
 *    (127.0.0.1 by default). No privseai server in the path.
 *  - Key safety: the gateway token is read from the local state dir at
 *    runtime; it is never persisted in app code or uploaded.
 *  - Companion-mode: the bridge never exposes tools — it is chat-only.
 *
 * Pure-ish core (no fetch inside logic) so tests can drive it with a
 * stubbed transport.
 */

export interface BitterbotBridgeConfig {
	/** OpenAI-compatible endpoint of the local bitterbot gateway. */
	baseUrl: string;
	/** Bearer token — resolved by the caller from the local state dir. */
	gatewayToken: string;
	/** Model id served by the gateway (must be one bitterbot knows). */
	model: string;
	/** Session key namespace so companion chats don't collide with the owner's. */
	sessionPrefix: string;
	/** Max chars forwarded per Telegram message (API limit guard). */
	maxMessageChars: number;
}

export const DEFAULT_BRIDGE_CONFIG: Omit<BitterbotBridgeConfig, "gatewayToken"> = {
	baseUrl: "http://127.0.0.1:19091",
	model: "kilocode/kilo-auto/free",
	sessionPrefix: "agent:main:openai-user:privseai",
	maxMessageChars: 3800, // Telegram text limit is 4096; leave headroom
};

/** Telegram-style chat id → stable gateway session key (per chat, per companion). */
export function sessionKeyFor(cfg: BitterbotBridgeConfig, chatId: string, companionId: string): string {
	const clean = chatId.replace(/[^A-Za-z0-9_-]/g, "");
	const comp = companionId.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
	return `${cfg.sessionPrefix}:${comp}:tg-${clean}`;
}

/** Minimal transport so unit tests never touch the network. */
export type ChatTransport = (
	url: string,
	init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown>; text: () => Promise<string> }>;

export const defaultTransport: ChatTransport = (url, init) => fetch(url, init);

export interface BridgeTurn {
	sessionKey: string;
	messages: { role: "system" | "user" | "assistant"; content: string }[];
	/** companion persona injected as the system prompt (from BitterbotSeed) */
	systemPrompt: string | null;
	maxTokens: number;
}

/** Compose an OpenAI-compatible request body for the gateway. */
export function buildTurnBody(
	cfg: BitterbotBridgeConfig,
	turn: BridgeTurn,
): string {
	const messages = turn.systemPrompt
		? [{ role: "system", content: turn.systemPrompt }, ...turn.messages]
		: turn.messages;
	return JSON.stringify({
		model: cfg.model,
		messages,
		max_tokens: turn.maxTokens,
	});
}

export interface BridgeResult {
	ok: boolean;
	content: string;
	/** truncated to Telegram-safe length */
	text: string;
	error?: string;
}

/**
 * One chat completion against the local bitterbot gateway.
 * Companion-mode: NO tools are offered (chat only).
 */
export async function bridgeTurn(
	cfg: BitterbotBridgeConfig,
	turn: BridgeTurn,
	transport: ChatTransport = defaultTransport,
): Promise<BridgeResult> {
	const url = `${cfg.baseUrl.replace(/\/$/, "")}/v1/chat/completions`;
	try {
		const res = await transport(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${cfg.gatewayToken}`,
				"x-bitterbot-session-key": turn.sessionKey,
			},
			body: buildTurnBody(cfg, turn),
		});
		if (!res.ok) {
			const detail = await res.text().catch(() => "");
			return {
				ok: false,
				content: "",
				text: "",
				error: `gateway ${res.status}${detail ? `: ${detail.slice(0, 160)}` : ""}`,
			};
		}
		const data = (await res.json()) as {
			choices?: { message?: { content?: string } }[];
		};
		const content = data.choices?.[0]?.message?.content ?? "";
		return {
			ok: true,
			content,
			text: content.slice(0, cfg.maxMessageChars),
		};
	} catch (err) {
		return {
			ok: false,
			content: "",
			text: "",
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

/**
 * Split a long reply into Telegram-sized chunks on whitespace boundaries.
 */
export function chunkForTelegram(text: string, limit: number): string[] {
	if (text.length <= limit) return [text];
	const chunks: string[] = [];
	let rest = text;
	while (rest.length > limit) {
		let cut = rest.lastIndexOf("\n", limit);
		if (cut < limit * 0.5) cut = rest.lastIndexOf(" ", limit);
		if (cut < limit * 0.5) cut = limit;
		chunks.push(rest.slice(0, cut).trimEnd());
		rest = rest.slice(cut).trimStart();
	}
	if (rest) chunks.push(rest);
	return chunks;
}

/**
 * Gateway token location note (do NOT import node:fs here — this module is
 * bundled for the browser): the token lives at `<stateDir>/gateway.token`
 * and Node-side callers (tests, telegram relay worker) read it there and
 * pass it into the config. The browser never needs it.
 */

/**
 * Sanity ping — verifies the gateway is alive and the token/model work.
 */
export async function pingGateway(
	cfg: BitterbotBridgeConfig,
	transport: ChatTransport = defaultTransport,
): Promise<{ ok: boolean; detail: string }> {
	const r = await bridgeTurn(
		cfg,
		{
			sessionKey: `${cfg.sessionPrefix}:ping`,
			messages: [{ role: "user", content: "Reply with exactly: PONG" }],
			systemPrompt: null,
			maxTokens: 10,
		},
		transport,
	);
	return { ok: r.ok && /PONG/i.test(r.content), detail: r.ok ? r.content : r.error ?? "" };
}
