import { describe, expect, it, vi } from "vitest";
import {
	companionToMyNeuro,
	myNeuroToCompanion,
	roundTripMyNeuro,
	validateMyNeuroProfile,
	toMyNeuroId,
} from "@/lib/integration/MyNeuroAdapter";
import {
	synthesizeSpeech,
	probeTTS,
	normalizeTTSEndpoint,
	configForCompanion,
	TTSBridgeError,
} from "@/lib/integration/TTSBridge";
import {
	toMemosRecord,
	fromMemosRecord,
	mergeMemories,
	memoryFingerprint,
	syncWithMemos,
	MemoryBridgeError,
} from "@/lib/integration/MemoryBridge";
import type { MemoryEntry } from "@/types/unified";

const companion = {
	id: "luna-01",
	name: "Luna",
	tagline: "nocturnal artist",
	age: 23,
	category: "realistic",
	gender: "female",
	avatarUrl: "/images/companions/luna-1.jpg",
	bio: "A painter who loves the night sky.",
	relationship: "Close Friend",
	occupation: "Illustrator",
	hobbies: ["stargazing"],
	personality: ["Warm", "Playful"],
	stage: 2,
	greeting: "Hi, I was waiting for you.",
	voiceAudioUrl: "/audio/luna-ref.mp3",
};

describe("MyNeuroAdapter", () => {
	it("maps a companion to a my-neuro profile with prompts and memory namespace", () => {
		const profile = companionToMyNeuro(companion);
		expect(profile.name).toBe("Luna");
		expect(profile.prompts?.system).toContain("You are Luna");
		expect(profile.memory?.namespace).toBe("luna-01");
		expect(profile.voice?.speaker).toBe("luna");
		expect(profile.voice?.referenceAudio).toBe("/audio/luna-ref.mp3");
	});

	it("imports a my-neuro profile back into a companion", () => {
		const profile = companionToMyNeuro(companion);
		const { companion: imported, warnings } = myNeuroToCompanion(profile);
		expect(imported.name).toBe("Luna");
		expect(imported.hasVoice).toBe(true);
		expect(imported.personality).toEqual(["Warm", "Playful"]);
		expect(warnings).toHaveLength(0);
	});

	it("round-trips without losing my-neuro-only fields", () => {
		const original = {
			name: "Rin",
			live2dModel: "/models/rin.model3.json",
			emotions: { happy: "smile" },
			prompts: { system: "You are Rin. Personality: cynical, witty." },
		};
		const out = roundTripMyNeuro(original);
		expect(out.live2dModel).toBe("/models/rin.model3.json");
		expect(out.emotions.happy).toBe("smile");
	});

	it("validates profiles and flags unsafe URLs", () => {
		expect(validateMyNeuroProfile({ name: "Ok" })).toHaveLength(0);
		expect(validateMyNeuroProfile(null).length).toBeGreaterThan(0);
		expect(
			validateMyNeuroProfile({ name: "X", voice: { engine: "gpt-sovits", referenceAudio: "javascript:alert(1)" } }),
		).toContain("voice.referenceAudio must be a local path or http(s) URL");
		expect(validateMyNeuroProfile({ name: "X", age: 999 })).toContain("age out of range");
	});

	it("slugifies ids", () => {
		expect(toMyNeuroId("Luna ☾ Star")).toBe("luna-star");
		expect(toMyNeuroId("")).toBe("companion");
	});
});

describe("TTSBridge", () => {
	it("requires consent before synthesizing", async () => {
		await expect(
			synthesizeSpeech({ endpoint: "http://127.0.0.1:9880", speaker: "x" }, { text: "hi" }, false),
		).rejects.toMatchObject({ code: "consent-required" });
	});

	it("rejects empty text", async () => {
		await expect(
			synthesizeSpeech({ endpoint: "http://127.0.0.1:9880", speaker: "x" }, { text: "  " }, true),
		).rejects.toMatchObject({ code: "empty-text" });
	});

	it("returns an audio blob on success", async () => {
		const audio = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/wav" });
		const fetchMock = vi.fn().mockResolvedValue(new Response(audio, { status: 200 }));
		const result = await synthesizeSpeech(
			{ endpoint: "http://127.0.0.1:9880/", speaker: "luna" },
			{ text: "hello" },
			true,
			fetchMock as unknown as typeof fetch,
		);
		expect(result.audio.size).toBe(3);
		expect(result.mimeType).toBe("audio/wav");
		const [url] = fetchMock.mock.calls[0] as [string];
		expect(url).toBe("http://127.0.0.1:9880/api/tts");
	});

	it("maps a provider error", async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
		await expect(
			synthesizeSpeech({ endpoint: "http://127.0.0.1:9880", speaker: "x" }, { text: "hi" }, true, fetchMock as unknown as typeof fetch),
		).rejects.toMatchObject({ code: "provider-error" });
	});

	it("normalizes endpoints and rejects bad schemes", () => {
		expect(normalizeTTSEndpoint("http://127.0.0.1:9880///")).toBe("http://127.0.0.1:9880");
		expect(() => normalizeTTSEndpoint("ftp://x")).toThrow(TTSBridgeError);
	});

	it("probes health and falls back to root", async () => {
		const healthOk = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
		expect((await probeTTS("http://127.0.0.1:9880", healthOk as unknown as typeof fetch)).online).toBe(true);
		const noHealth = vi
			.fn()
			.mockRejectedValueOnce(new Error("404"))
			.mockResolvedValueOnce(new Response("", { status: 200 }));
		expect((await probeTTS("http://127.0.0.1:9880", noHealth as unknown as typeof fetch)).online).toBe(true);
	});

	it("builds config from a companion", () => {
		const cfg = configForCompanion({ name: "Yuna", voiceAudioUrl: "/a.wav" });
		expect(cfg.speaker).toBe("yuna");
		expect(cfg.referenceAudio).toBe("/a.wav");
	});
});

const entry = (id: string, content: string): MemoryEntry => ({
	id,
	type: "fact",
	content,
	importance: 1,
	tags: [],
	createdAt: 1700000000000,
	lastAccessedAt: 1700000000000,
	accessCount: 0,
	source: "conversation",
});

describe("MemoryBridge", () => {
	it("round-trips a memory entry through a Memos record", () => {
		const record = toMemosRecord(entry("m1", "user likes cats"), "luna");
		expect(record.creator).toBe("luna");
		const back = fromMemosRecord(record);
		expect(back.content).toBe("user likes cats");
		expect(back.type).toBe("fact");
	});

	it("merges without duplicating by id or content", () => {
		const local = [entry("m1", "alpha")];
		const remote = [
			toMemosRecord(entry("m1", "alpha"), "n"), // same id
			toMemosRecord(entry("m2", "alpha"), "n"), // same content
			toMemosRecord(entry("m3", "beta"), "n"), // new
		];
		const { merged, added, skipped } = mergeMemories(local, remote);
		expect(added).toBe(1);
		expect(skipped).toBe(2);
		expect(merged).toHaveLength(2);
	});

	it("produces stable fingerprints", () => {
		expect(memoryFingerprint(entry("a", "hello"))).toBe(memoryFingerprint(entry("b", "hello")));
	});

	it("rejects a non-http endpoint", async () => {
		await expect(syncWithMemos({ endpoint: "ws://x", namespace: "n" }, [])).rejects.toBeInstanceOf(
			MemoryBridgeError,
		);
	});

	it("pulls remote records during a sync", async () => {
		const remote = { memos: [{ id: "r1", content: "remote note", createdAt: new Date().toISOString() }] };
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify(remote), { status: 200 }))
			.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
		const { merged, added } = await syncWithMemos(
			{ endpoint: "http://127.0.0.1:8081", namespace: "luna" },
			[entry("m1", "local note")],
			fetchMock as unknown as typeof fetch,
		);
		expect(added).toBe(1);
		expect(merged.map((m) => m.content)).toContain("remote note");
	});
});
