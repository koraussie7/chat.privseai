import { describe, expect, it } from "vitest";
/**
 * Tests for model presets (P2P-shareable local model recipes).
 */

import {
	buildRunCommand,
	defaultEndpoint,
	estimateFitsDevice,
	validatePreset,
	SEED_PRESETS,
	type ModelPreset,
} from "@/lib/model-presets";

const BASE_PRESET: ModelPreset = {
	id: "test-preset",
	name: "Test Model",
	hfRepo: "org/test-model-GGUF",
	quantization: "Q4_K_M",
	runtime: "ollama",
	contextLength: 8192,
	minRamGb: 8,
	isNSFW: true,
	description: "A test model.",
	tags: ["test"],
	createdAt: 1700000000000,
};

describe("buildRunCommand", () => {
	it("builds ollama command", () => {
		expect(buildRunCommand(BASE_PRESET)).toBe("ollama run hf.co/org/test-model-GGUF:Q4_K_M");
	});
	it("builds llamacpp command", () => {
		expect(buildRunCommand({ ...BASE_PRESET, runtime: "llamacpp" })).toBe(
			"llama-server -hf org/test-model-GGUF:Q4_K_M",
		);
	});
	it("guides LM Studio as a comment", () => {
		const cmd = buildRunCommand({ ...BASE_PRESET, runtime: "lmstudio" });
		expect(cmd).toContain("LM Studio");
	});
	it("warns WebLLM cannot run GGUF", () => {
		const cmd = buildRunCommand({ ...BASE_PRESET, runtime: "webllm" });
		expect(cmd).toContain("MLC");
	});
});

describe("defaultEndpoint", () => {
	it.each([
		["ollama", "http://127.0.0.1:11434"],
		["llamacpp", "http://127.0.0.1:8080"],
		["lmstudio", "http://127.0.0.1:1234"],
	])("maps %s to %s", (runtime, url) => {
		expect(defaultEndpoint({ ...BASE_PRESET, runtime } as ModelPreset)).toBe(url);
	});
});

describe("estimateFitsDevice", () => {
	it("returns null (unknown) without navigator memory", () => {
		const { fits } = estimateFitsDevice(BASE_PRESET);
		expect(fits).toBeNull();
	});
});

describe("validatePreset", () => {
	it("accepts a valid preset and normalizes tags", () => {
		const out = validatePreset(BASE_PRESET);
		expect(out.tags).toEqual(["test"]);
		expect(out.isNSFW).toBe(true);
	});
	it("rejects bad hfRepo", () => {
		expect(() => validatePreset({ ...BASE_PRESET, hfRepo: "" })).toThrow();
		expect(() => validatePreset({ ...BASE_PRESET, hfRepo: "http://evil.com/x" })).toThrow();
	});
	it("rejects unknown runtime", () => {
		expect(() => validatePreset({ ...BASE_PRESET, runtime: "magic" })).toThrow();
	});
	it("rejects absurd memory/context values", () => {
		expect(() => validatePreset({ ...BASE_PRESET, minRamGb: 9999 })).toThrow();
		expect(() => validatePreset({ ...BASE_PRESET, contextLength: 10 })).toThrow();
	});
});

describe("seed presets", () => {
	it("include the Qwen3.5 NSFW RP model, gated with isNSFW", () => {
		const target = SEED_PRESETS.find((p) => p.id === "qwen35-9b-nsfw-rp-q4");
		expect(target).toBeDefined();
		expect(target!.isNSFW).toBe(true);
		expect(target!.hfRepo).toContain("Qwen3.5");
	});
});
