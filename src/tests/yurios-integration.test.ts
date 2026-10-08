import { describe, it, expect, beforeEach, vi } from "vitest";
import { YuriOSBridge } from "@/lib/yurios-bridge";
import { VRMLoader } from "@/lib/vrm-loader";
import { TelegramRelay, createTelegramRelay } from "@/lib/telegram-relay";

describe("YuriOSBridge", () => {
	let bridge: YuriOSBridge;

	beforeEach(() => {
		bridge = new YuriOSBridge();
	});

	it("parses YuriOS card format", () => {
		const card = bridge.parseYuriOSCard(JSON.stringify({
			name: "Yuri",
			description: "A shy AI girl.",
			personality: { traits: ["Shy", "Bookish"] },
			extensions: { vrm: "https://yuri.os/models/yuri.vrm", stage: "close" },
			tags: ["romantic"],
		}));
		expect(card.spec).toBe("chara_card_v2");
		expect(card.data.name).toBe("Yuri");
		expect(card.data.personality).toContain("Shy");
	});

	it("converts YuriOS card to CompanionProfile", () => {
		const card = bridge.parseYuriOSCard(JSON.stringify({
			name: "Aoi",
			description: "Friendly AI.",
			personality: "Playful\nSmart",
			tags: ["gf"],
			extensions: { vrm: "aoi.vrm", stage: "partner" },
		}));
		const profile = bridge.importYuriOSCompanion(card);
		expect(profile.name).toBe("Aoi");
		expect(profile.avatarUrl).toBe("aoi.vrm");
		expect(profile.stage).toBe(4);
	});

	it("creates config from env", () => {
		const config = bridge.createYuriOSConfig({
			MIND_TOOLS_ENABLED: "true",
			MIND_DAILY_TOKENS: "10000",
			MIND_TOOL_ALLOWLIST: "write_note,read_note",
			SEARCH_BACKEND: "off",
		});
		expect(config.mindToolsEnabled).toBe(true);
		expect(config.mindDailyTokens).toBe(10000);
		expect(config.searchBackend).toBe(false);
	});

	it("calculates token cost", () => {
		const cost = bridge.calculateTokenCost("Hello world test", "Hello to you too!");
		expect(cost).toBeGreaterThan(0);
	});

	it("checks budget limits", () => {
		const config = bridge.createYuriOSConfig({ MIND_TOOLS_ENABLED: "false" });
		expect(bridge.checkBudget(config, false).allowed).toBe(true);
		expect(bridge.checkBudget(config, true).allowed).toBe(false);
	});

	it("logs tool calls in audit", () => {
		bridge.logToolCall({
			timestamp: Date.now(),
			tool: "web_search",
			args: { query: "weather" },
			result: "Sunny",
			tokenCost: 150,
		});
		const audit = bridge.getToolAudit();
		expect(audit.length).toBe(1);
		expect(audit[0].tool).toBe("web_search");
	});

	it("maps activity states", () => {
		expect(bridge.mapActivityState("engaged")).toBe("ENGAGED");
		expect(bridge.mapActivityState("DREAM")).toBe("DREAM");
		expect(bridge.mapActivityState("unknown")).toBe("IDLE");
	});

	it("registers and retrieves companions", () => {
		const companion = {
			id: "yuri-001",
			name: "Yuri",
			card: { spec: "chara_card_v2" as const, data: { name: "Yuri" } },
			profile: { id: "yuri-001", name: "Yuri", stage: 2 },
			config: bridge.createYuriOSConfig({}),
			vaultPath: "/vault/yuri-001",
			activityState: "ENGAGED" as const,
			mindLoopRunning: true,
			lastTick: Date.now(),
		};
		bridge.registerCompanion(companion as any);
		expect(bridge.getCompanion("yuri-001")?.name).toBe("Yuri");
		expect(bridge.getAllCompanions().length).toBe(1);
	});
});

describe("VRMLoader", () => {
	let loader: VRMLoader;

	beforeEach(() => {
		loader = new VRMLoader();
	});

	it("detects VRM 0.72", async () => {
		expect(await loader.detectVRMVersion("unity.com/VRM spec data")).toBe("0.72");
	});

	it("detects VRM 1.0", async () => {
		expect(await loader.detectVRMVersion("VRM1.0 Khronos")).toBe("1.0");
	});

	it("returns unknown for unrecognized", async () => {
		expect(await loader.detectVRMVersion("not a vrm")).toBe("unknown");
	});

	it("returns config for loaded model", () => {
		expect(loader.getConfig("test")).toBeUndefined();
	});
});

describe("TelegramRelay", () => {
	it("creates relay", () => {
		expect(createTelegramRelay("http://localhost:8768", "token")).toBeInstanceOf(TelegramRelay);
	});

	it("manages handlers and polling", () => {
		const relay = createTelegramRelay("http://localhost:8768", "token");
		const handler = vi.fn();
		const unsub = relay.onTelegramMessage(handler);
		expect(typeof unsub).toBe("function");
		unsub();
		relay.startPolling();
		relay.stopPolling();
	});
});
