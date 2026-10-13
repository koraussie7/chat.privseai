/**
 * Tests for the bitterbot desktop bridge (bitterbot-bridge.ts).
 * All network interaction is stubbed — no test ever touches localhost.
 */
import { describe, expect, it, vi } from "vitest";
import {
	buildTurnBody,
	chunkForTelegram,
	bridgeTurn,
	pingGateway,
	sessionKeyFor,
	DEFAULT_BRIDGE_CONFIG,
	type BitterbotBridgeConfig,
	type ChatTransport,
} from "@/lib/bitterbot-bridge";
import { companionToBitterbotSeed } from "@/lib/integration/BitterbotAdapter";
import type { CandyCompanionLike } from "@/lib/integration/my-neuro-types";

const cfg: BitterbotBridgeConfig = {
	...DEFAULT_BRIDGE_CONFIG,
	gatewayToken: "test-token",
};

const companion: CandyCompanionLike = {
	id: "luna-01",
	name: "Luna",
	tagline: "밤하늘 컴패니언",
	category: "anime",
	gender: "female",
	avatarUrl: "https://example.com/l.png",
	bio: "테스트 페르소나",
	personality: ["다정함"],
	hobbies: ["별 보기"],
	greeting: "안녕!",
};

function okTransport(content: string): ChatTransport {
	return vi.fn(async () => ({
		ok: true,
		status: 200,
		json: async () => ({ choices: [{ message: { content } }] }),
		text: async () => "",
	}));
}

describe("sessionKeyFor", () => {
	it("namespaces per companion + telegram chat", () => {
		expect(sessionKeyFor(cfg, "12345", "luna-01")).toBe(
			"agent:main:openai-user:privseai:luna-01:tg-12345",
		);
	});
	it("strips unsafe chars from ids", () => {
		const k = sessionKeyFor(cfg, "../../etc", "bad/../id");
		expect(k).not.toMatch(/\.\.|\//);
	});
});

describe("buildTurnBody", () => {
	it("injects companion system prompt first", () => {
		const seed = companionToBitterbotSeed(companion);
		const body = JSON.parse(
			buildTurnBody(cfg, {
				sessionKey: "s",
				messages: [{ role: "user", content: "hi" }],
				systemPrompt: seed.genome,
				maxTokens: 200,
			}),
		);
		expect(body.messages[0].role).toBe("system");
		expect(body.messages[0].content).toContain("## Safety axioms");
		expect(body.messages[1]).toEqual({ role: "user", content: "hi" });
		expect(body.model).toBe(cfg.model);
	});

	it("offers NO tools (companion mode — chat only)", () => {
		const body = buildTurnBody(cfg, {
			sessionKey: "s",
			messages: [{ role: "user", content: "hi" }],
			systemPrompt: null,
			maxTokens: 10,
		});
		expect(body).not.toMatch(/"tools"/);
		expect(body).not.toMatch(/function/i);
	});
});

describe("bridgeTurn", () => {
	it("returns gateway content truncated to Telegram-safe length", async () => {
		const long = "가".repeat(5000);
		const r = await bridgeTurn(cfg, {
			sessionKey: "s",
			messages: [{ role: "user", content: "hi" }],
			systemPrompt: null,
			maxTokens: 100,
		}, okTransport(long));
		expect(r.ok).toBe(true);
		expect(r.text.length).toBe(cfg.maxMessageChars);
	});

	it("sends the session key header (session continuity)", async () => {
		const t = okTransport("ok");
		await bridgeTurn(cfg, {
			sessionKey: "agent:main:openai-user:privseai:luna-01:tg-42",
			messages: [{ role: "user", content: "hi" }],
			systemPrompt: null,
			maxTokens: 10,
		}, t);
		expect(vi.mocked(t)).toHaveBeenCalled();
		const init = vi.mocked(t).mock.calls[0][1];
		expect(init.headers["x-bitterbot-session-key"]).toContain("tg-42");
		expect(init.headers.Authorization).toBe("Bearer test-token");
	});

	it("surfaces gateway errors without throwing", async () => {
		const t: ChatTransport = vi.fn(async () => ({
			ok: false,
			status: 429,
			json: async () => ({}),
			text: async () => "rate limited",
		}));
		const r = await bridgeTurn(cfg, {
			sessionKey: "s",
			messages: [{ role: "user", content: "hi" }],
			systemPrompt: null,
			maxTokens: 10,
		}, t);
		expect(r.ok).toBe(false);
		expect(r.error).toMatch(/429/);
	});

	it("catches transport failures (gateway down)", async () => {
		const t: ChatTransport = vi.fn(async () => {
			throw new Error("ECONNREFUSED");
		});
		const r = await bridgeTurn(cfg, {
			sessionKey: "s",
			messages: [{ role: "user", content: "hi" }],
			systemPrompt: null,
			maxTokens: 10,
		}, t);
		expect(r.ok).toBe(false);
		expect(r.error).toMatch(/ECONNREFUSED/);
	});
});

describe("chunkForTelegram", () => {
	it("passes short text through", () => {
		expect(chunkForTelegram("hello", 100)).toEqual(["hello"]);
	});
	it("splits long text on newline boundaries", () => {
		const text = "a".repeat(60) + "\n" + "b".repeat(60);
		const chunks = chunkForTelegram(text, 80);
		expect(chunks.length).toBe(2);
		expect(chunks[0].length).toBeLessThanOrEqual(80);
	});
	it("hard-splits when no boundary exists", () => {
		const chunks = chunkForTelegram("x".repeat(250), 100);
		expect(chunks.length).toBe(3);
		chunks.forEach((c) => expect(c.length).toBeLessThanOrEqual(100));
	});
});

describe("pingGateway", () => {
	it("detects a healthy gateway", async () => {
		const r = await pingGateway(cfg, okTransport("PONG"));
		expect(r.ok).toBe(true);
	});
	it("fails on wrong reply", async () => {
		const r = await pingGateway(cfg, okTransport("something else"));
		expect(r.ok).toBe(false);
	});
});
