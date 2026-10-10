import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	QUOTA_KEY_STORAGE,
	QuotaExceededError,
	fetchQuotaStatus,
	getQuotaKey,
	maskQuotaKey,
	quotaChat,
	setQuotaKey,
	tryQuotaChat,
} from "@/lib/freellmpool-client";

// Node test env has no localStorage — mock it in-memory (same pattern as
// byok-store.test.ts). Never unstubAllGlobals() (it would drop this mock).
const store = new Map<string, string>();
const localStorageMock = {
	getItem: (k: string) => (store.has(k) ? store.get(k) : null),
	setItem: (k: string, v: string) => void store.set(k, String(v)),
	removeItem: (k: string) => void store.delete(k),
	clear: () => store.clear(),
} as Storage;
vi.stubGlobal("localStorage", localStorageMock);

beforeEach(() => {
	store.clear();
	vi.stubGlobal("localStorage", localStorageMock);
});

describe("quota key management", () => {
	it("auto-generates and persists a qp_ key", () => {
		const key = getQuotaKey();
		expect(key.startsWith("qp_")).toBe(true);
		expect(key.length).toBe(3 + 32);
		expect(localStorage.getItem(QUOTA_KEY_STORAGE)).toBe(key);
	});

	it("returns the same key on subsequent calls (stable quota identity)", () => {
		expect(getQuotaKey()).toBe(getQuotaKey());
	});

	it("setQuotaKey overrides and empty clears", () => {
		setQuotaKey("qp_server_minted_key");
		expect(getQuotaKey()).toBe("qp_server_minted_key");
		setQuotaKey("  ");
		expect(localStorage.getItem(QUOTA_KEY_STORAGE)).toBeNull();
		// Next call re-generates.
		expect(getQuotaKey().startsWith("qp_")).toBe(true);
	});

	it("masks keys for display", () => {
		expect(maskQuotaKey("qp_0123456789abcdef0123456789abcdef")).toBe("qp_...cdef");
		expect(maskQuotaKey("short")).toBe("••••");
	});
});

describe("quotaChat transport", () => {
	it("sends the quota key as Bearer to the gateway", async () => {
		setQuotaKey("qp_user1");
		const fetchMock = vi.fn(async () =>
			new Response(
				JSON.stringify({
					choices: [{ message: { content: "hello from pool" } }],
					usage: { prompt_tokens: 3, completion_tokens: 5, total_tokens: 8 },
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			),
		);
		vi.stubGlobal("fetch", fetchMock);
		try {
			const result = await quotaChat([{ role: "user", content: "hi" }]);
			expect(result.reply).toBe("hello from pool");
			expect(result.usage?.total_tokens).toBe(8);
			const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
			expect(url).toBe("/freellm/v1/chat/completions");
			expect((init.headers as Record<string, string>).Authorization).toBe("Bearer qp_user1");
		} finally {
			vi.stubGlobal("fetch", undefined as unknown as typeof fetch);
		}
	});


	it("throws QuotaExceededError with reset on 429", async () => {
		setQuotaKey("qp_exhausted");
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							error: {
								message:
									"Daily quota exceeded (100/100 requests). Resets at 2026-10-11T00:00:00Z.",
								type: "user_quota_exceeded",
								code: 429,
							},
						}),
						{
							status: 429,
							headers: {
								"Content-Type": "application/json",
								"X-Quota-Reset": "2026-10-11T00:00:00Z",
								"X-Quota-Remaining": "0",
							},
						},
					),
			),
		);
		try {
			await expect(quotaChat([{ role: "user", content: "hi" }])).rejects.toMatchObject({
				name: "QuotaExceededError",
				reset: "2026-10-11T00:00:00Z",
				remainingRequests: 0,
			});
			await expect(quotaChat([{ role: "user", content: "hi" }])).rejects.toBeInstanceOf(
				QuotaExceededError,
			);
		} finally {
			vi.stubGlobal("fetch", undefined as unknown as typeof fetch);
		}
	});

	it("throws a plain Error with upstream detail on non-429 failure", async () => {
		setQuotaKey("qp_bad");
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({ error: { message: "freellmpool upstream unreachable" } }),
						{ status: 502 },
					),
			),
		);
		try {
			await expect(quotaChat([{ role: "user", content: "hi" }])).rejects.toThrow(
				"freellmpool gateway: freellmpool upstream unreachable",
			);
		} finally {
			vi.stubGlobal("fetch", undefined as unknown as typeof fetch);
		}
	});
});

describe("fetchQuotaStatus", () => {
	it("parses the quota window", async () => {
		setQuotaKey("qp_user1");
		const quota = {
			day: "2026-10-10",
			used_requests: 3,
			used_tokens: 120,
			limit_requests: 100,
			limit_tokens: 200000,
			remaining_requests: 97,
			remaining_tokens: 199880,
			reset: "2026-10-11T00:00:00Z",
		};
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(JSON.stringify({ user: "user1", quota }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					}),
			),
		);
		try {
			await expect(fetchQuotaStatus()).resolves.toEqual(quota);
		} finally {
			vi.stubGlobal("fetch", undefined as unknown as typeof fetch);
		}
	});

	it("returns null when offline", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
		try {
			await expect(fetchQuotaStatus()).resolves.toBeNull();
		} finally {
			vi.stubGlobal("fetch", undefined as unknown as typeof fetch);
		}
	});
});

describe("tryQuotaChat fallback hook", () => {
	it("returns the reply on success", async () => {
		setQuotaKey("qp_ok");
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(JSON.stringify({ choices: [{ message: { content: "pooled!" } }] }), {
						status: 200,
					}),
			),
		);
		try {
			await expect(tryQuotaChat([{ role: "user", content: "hi" }])).resolves.toBe("pooled!");
		} finally {
			vi.stubGlobal("fetch", undefined as unknown as typeof fetch);
		}
	});

	it("swallows failures by default, propagates QuotaExceededError on request", async () => {
		setQuotaKey("qp_empty");
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(JSON.stringify({ error: { message: "Daily quota exceeded" } }), {
						status: 429,
						headers: { "X-Quota-Reset": "2026-10-11T00:00:00Z" },
					}),
			),
		);
		try {
			await expect(tryQuotaChat([{ role: "user", content: "hi" }])).resolves.toBeNull();
			await expect(
				tryQuotaChat([{ role: "user", content: "hi" }], { propagateQuota: true }),
			).rejects.toBeInstanceOf(QuotaExceededError);
		} finally {
			vi.stubGlobal("fetch", undefined as unknown as typeof fetch);
		}
	});
});
