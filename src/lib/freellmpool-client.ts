/**
 * freellmpool quota-gateway client — pooled free-LLM chat with per-user quotas.
 *
 * Architecture (see INTEGRATION_FREELLMPOOL.md):
 *
 *   browser ──(X-Quota-Key: qp_...)──▶ quota-gateway :4005 ──▶ freellmpool :8080
 *
 * freellmpool pools 20+ free LLM providers behind one OpenAI-compatible
 * endpoint but has no end-user concept. The quota-gateway adds per-user
 * daily request/token quotas and returns OpenAI-style 429s. This module:
 *
 *   1. Manages the user's quota key (`qp_…`) in localStorage — anonymous
 *      device-bound by default, or a server-minted key the user can paste.
 *   2. Talks to the gateway's `/v1/chat/completions` + `/v1/quota`.
 *   3. Surfaces quota errors as `QuotaExceededError` so chat UIs can show
 *      "daily limit reached, resets at …" instead of a generic failure.
 *
 * The gateway URL is configured via `quotaGatewayUrl()` in config.ts
 * (VITE_QUOTA_GATEWAY_URL, default same-origin `/freellm`).
 */
import { quotaGatewayUrl } from "@/lib/config";

export const QUOTA_KEY_STORAGE = "privsei.quota.key";

export interface QuotaStatus {
	day: string;
	used_requests: number;
	used_tokens: number;
	limit_requests: number;
	limit_tokens: number;
	/** -1 means unlimited */
	remaining_requests: number;
	remaining_tokens: number;
	/** ISO-8601 UTC reset time */
	reset: string;
}

export class QuotaExceededError extends Error {
	constructor(
		message: string,
		readonly reset: string,
		readonly remainingRequests: number,
	) {
		super(message);
		this.name = "QuotaExceededError";
	}
}

function randomKey(): string {
	const bytes = new Uint8Array(16);
	if (typeof crypto !== "undefined" && crypto.getRandomValues) {
		crypto.getRandomValues(bytes);
	} else {
		for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
	}
	return `qp_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * The user's quota key. Auto-generates and persists an anonymous key on
 * first use; each key is a stable quota identity server-side (unregistered
 * keys get the default daily quota under an `anon:` identity).
 */
export function getQuotaKey(): string {
	try {
		const existing = localStorage.getItem(QUOTA_KEY_STORAGE)?.trim();
		if (existing) return existing;
		const key = randomKey();
		localStorage.setItem(QUOTA_KEY_STORAGE, key);
		return key;
	} catch {
		// Private mode / disabled storage — ephemeral per-page key.
		return randomKey();
	}
}

/** Replace the stored key (e.g. paste a server-minted `qp_…` key). */
export function setQuotaKey(key: string): void {
	const trimmed = key.trim();
	if (!trimmed) {
		localStorage.removeItem(QUOTA_KEY_STORAGE);
		return;
	}
	localStorage.setItem(QUOTA_KEY_STORAGE, trimmed);
}

/** Masked form for UI display (same convention as byok-store.maskKey). */
export function maskQuotaKey(key: string): string {
	if (key.length <= 12) return "••••";
	return `${key.slice(0, 3)}...${key.slice(-4)}`;
}

function gatewayHeaders(): Record<string, string> {
	return {
		"Content-Type": "application/json",
		Authorization: `Bearer ${getQuotaKey()}`,
	};
}


/** Current user's quota window (used/limit/reset). Null when offline. */
export async function fetchQuotaStatus(signal?: AbortSignal): Promise<QuotaStatus | null> {
	try {
		const res = await fetch(`${quotaGatewayUrl()}/v1/quota`, {
			headers: gatewayHeaders(),
			signal: signal ?? AbortSignal.timeout(5000),
		});
		if (!res.ok) return null;
		const data = (await res.json()) as { quota?: QuotaStatus };
		return data.quota ?? null;
	} catch {
		return null;
	}
}

export interface QuotaChatOptions {
	model?: string;
	temperature?: number;
	maxTokens?: number;
	signal?: AbortSignal;
}

export interface QuotaChatResult {
	reply: string;
	model?: string;
	usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

/**
 * Chat via the quota-gateway. Throws:
 *  - `QuotaExceededError` on 429 (daily quota hit)
 *  - plain `Error` for auth/upstream/network failures
 */
export async function quotaChat(
	messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
	opts: QuotaChatOptions = {},
): Promise<QuotaChatResult> {
	const res = await fetch(`${quotaGatewayUrl()}/v1/chat/completions`, {
		method: "POST",
		headers: gatewayHeaders(),
		body: JSON.stringify({
			model: opts.model ?? "auto",
			messages,
			temperature: opts.temperature ?? 0.7,
			max_tokens: opts.maxTokens ?? 512,
			stream: false,
		}),
		signal: opts.signal ?? AbortSignal.timeout(60000),
	});

	if (res.status === 429) {
		const reset = res.headers.get("X-Quota-Reset") ?? "";
		const remaining = Number(res.headers.get("X-Quota-Remaining") ?? "0");
		let message = "Daily quota exceeded.";
		try {
			const data = (await res.json()) as { error?: { message?: string } };
			if (data.error?.message) message = data.error.message;
		} catch {
			/* keep default message */
		}
		throw new QuotaExceededError(message, reset, Number.isFinite(remaining) ? remaining : 0);
	}

	if (!res.ok) {
		let detail = `HTTP ${res.status}`;
		try {
			const data = (await res.json()) as { error?: { message?: string } };
			if (data.error?.message) detail = data.error.message;
		} catch {
			/* keep default detail */
		}
		throw new Error(`freellmpool gateway: ${detail}`);
	}

	const data = (await res.json()) as {
		choices?: Array<{ message?: { content?: string } }>;
		model?: string;
		usage?: QuotaChatResult["usage"];
	};
	const reply = data.choices?.[0]?.message?.content;
	if (!reply) throw new Error("freellmpool gateway: empty response");
	return { reply, model: data.model, usage: data.usage };
}

/**
 * Integration hook for chat fallback chains: attempts a quota-gateway chat
 * and returns the reply text, or null on failure so callers can fall through
 * to the next backend. Quota errors are terminal for the free tier — pass
 * `propagateQuota: true` to re-throw `QuotaExceededError` instead of
 * silently falling back (offline replies would hide the real cause).
 */
export async function tryQuotaChat(
	messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
	opts: QuotaChatOptions & { propagateQuota?: boolean } = {},
): Promise<string | null> {
	try {
		const result = await quotaChat(messages, opts);
		return result.reply;
	} catch (err) {
		if (err instanceof QuotaExceededError && opts.propagateQuota) throw err;
		return null;
	}
}
