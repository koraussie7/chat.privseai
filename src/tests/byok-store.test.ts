import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  BYOK_STORAGE_KEY,
  byokProvidersReady,
  getByokKey,
  loadByokKeys,
  maskKey,
  saveByokKeys,
  setByokKey,
} from "@/lib/byok-store";
import { tryByokChat } from "@/lib/byok-chat";

// Node test env has no localStorage — mock it in-memory.
// NOTE: individual tests must use vi.stubGlobal("fetch", …) only for fetch,
// never unstubAllGlobals() (that would also drop this localStorage mock).
const store = new Map<string, string>();
const localStorageMock = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
} as Storage;
vi.stubGlobal("localStorage", localStorageMock);

beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", localStorageMock);
});

describe("byok-store", () => {
  it("returns empty when nothing stored", () => {
    expect(loadByokKeys()).toEqual({});
    expect(byokProvidersReady()).toEqual([]);
    expect(getByokKey("openai")).toBeUndefined();
  });

  it("saves and loads per-provider keys", () => {
    saveByokKeys({ openai: "sk-test-openai", gemini: "AIza-test" });
    expect(getByokKey("openai")).toBe("sk-test-openai");
    expect(getByokKey("gemini")).toBe("AIza-test");
    expect(byokProvidersReady()).toEqual(["openai", "gemini"]);
  });

  it("setByokKey clears with empty string", () => {
    setByokKey("openai", "sk-abc");
    expect(getByokKey("openai")).toBe("sk-abc");
    setByokKey("openai", "  ");
    expect(getByokKey("openai")).toBeUndefined();
  });

  it("reads legacy raw-string shape as openai key", () => {
    localStorage.setItem(BYOK_STORAGE_KEY, "sk-legacy-raw");
    expect(getByokKey("openai")).toBe("sk-legacy-raw");
  });

  it("reads legacy {apiKey} and {openai:{apiKey}} shapes", () => {
    localStorage.setItem(BYOK_STORAGE_KEY, JSON.stringify({ apiKey: "sk-old" }));
    expect(getByokKey("openai")).toBe("sk-old");
    localStorage.setItem(BYOK_STORAGE_KEY, JSON.stringify({ openai: { apiKey: "sk-old2" } }));
    expect(getByokKey("openai")).toBe("sk-old2");
  });

  it("removes storage item when all keys cleared", () => {
    setByokKey("openai", "sk-x");
    setByokKey("openai", "");
    expect(localStorage.getItem(BYOK_STORAGE_KEY)).toBeNull();
  });

  it("masks keys for display", () => {
    expect(maskKey("sk-abcdefghij1234")).toBe("sk-...1234");
    expect(maskKey("short")).toBe("••••");
  });
});

describe("byok-chat transport", () => {
  it("returns null when no key is stored", async () => {
    await expect(tryByokChat("hi", "sys", [])).resolves.toBeNull();
  });

  it("hits same-origin /api/byok/<provider>/* (never double-prefixed)", async () => {
    setByokKey("openai", "sk-test-key");
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "hello" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      const res = await tryByokChat("hi", "sys", []);
      expect(res).toEqual({ reply: "hello", provider: "openai" });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      // Must be same-origin path the dev proxy / Caddy passthrough serve…
      expect(url).toBe("/api/byok/openai/v1/chat/completions");
      // …with the user's key forwarded as Bearer, untouched.
      expect((init.headers as Record<string, string>).Authorization).toBe(
        "Bearer sk-test-key",
      );
    } finally {
      vi.stubGlobal("fetch", undefined as unknown as typeof fetch);
    }
  });

  it("falls through to null when provider rejects the key", async () => {
    setByokKey("openai", "sk-bad-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("unauthorized", { status: 401 })),
    );
    try {
      await expect(tryByokChat("hi", "sys", [])).resolves.toBeNull();
    } finally {
      vi.stubGlobal("fetch", undefined as unknown as typeof fetch);
    }
  });
});
