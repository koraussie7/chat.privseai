/**
 * Tests for BitterbotAdapter — companion → bitterbot seed bundle.
 * Mirrors the style/conventions of my-neuro-bridges.test.ts.
 */
import { describe, expect, it } from "vitest";
import {
	companionToBitterbotSeed,
	companionToGenome,
	companionToMemoryPatch,
	validateBitterbotSeed,
} from "@/lib/integration/BitterbotAdapter";
import { companionToMyNeuro } from "@/lib/integration/MyNeuroAdapter";
import type { CandyCompanionLike } from "@/lib/integration/my-neuro-types";

const base: CandyCompanionLike = {
	id: "luna-01",
	name: "Luna",
	tagline: "밤하늘을 좋아하는 몽상가",
	age: 24,
	category: "anime",
	gender: "female",
	avatarUrl: "https://example.com/luna.png",
	bio: "차분하고 다정한 성격의 컴패니언.",
	personality: ["다정함", "차분함", "호기심"],
	hobbies: ["별 보기", "시 쓰기"],
	greeting: "안녕, 오늘 하루 어땠어?",
};

describe("companionToGenome", () => {
	it("emits immutable GENOME with identity block", () => {
		const g = companionToGenome(base);
		expect(g).toContain("# GENOME — Luna");
		expect(g).toContain("## Identity");
		expect(g).toContain("luna-01");
	});

	it("keeps the safety axioms that restrict companion-mode tools", () => {
		const g = companionToGenome(base);
		expect(g).toContain("## Safety axioms");
		expect(g).toContain("셸·브라우저·지갑 도구는 사용하지 않습니다");
		expect(g).toContain("Mesh OFF by default");
	});

	it("includes greeting and personality", () => {
		const g = companionToGenome(base);
		expect(g).toContain("안녕, 오늘 하루 어땠어?");
		expect(g).toContain("다정함");
	});

	it("prefers my-neuro profile values when provided", () => {
		const profile = companionToMyNeuro(base);
		profile.prompts = { ...profile.prompts, system: profile.prompts?.system ?? "", greeting: "커스텀 인사" };
		const g = companionToGenome(base, profile);
		expect(g).toContain("커스텀 인사");
	});
});

describe("companionToMemoryPatch", () => {
	it("points at the shared Memos namespace", () => {
		const m = companionToMemoryPatch(base);
		expect(m).toContain("luna-01");
		expect(m).toContain("Memos namespace");
	});

	it("carries seed memories from extensions", () => {
		const profile = companionToMyNeuro(base);
		profile.extensions = { memories: ["첫 만남은 별이 잘 보이는 밤이었다."] };
		const m = companionToMemoryPatch(base, profile);
		expect(m).toContain("첫 만남은 별이 잘 보이는 밤이었다.");
	});
});

describe("companionToBitterbotSeed", () => {
	it("produces a complete, valid seed bundle", () => {
		const profile = companionToMyNeuro(base);
		const seed = companionToBitterbotSeed(base, profile);
		expect(seed.format).toBe("privseai-bitterbot-seed");
		expect(seed.version).toBe(1);
		expect(seed.agentMode).toBe("companion");
		expect(seed.files.genomeFilename).toBe("identity/GENOME-luna-01.md");
		expect(seed.files.memoryFilename).toBe("identity/MEMORY-luna-01.md");
		expect(validateBitterbotSeed(seed)).toEqual([]);
	});

	it("warns when the LLM provider is not local (privacy precondition)", () => {
		const profile = companionToMyNeuro(base);
		profile.llm = { provider: "remote", model: "gpt-x" };
		const seed = companionToBitterbotSeed(base, profile);
		expect(seed.warnings.join(" ")).toMatch(/Ollama/i);
	});

	it("warns when no reference audio is configured", () => {
		const profile = companionToMyNeuro(base);
		const seed = companionToBitterbotSeed(base, profile);
		expect(seed.warnings.join(" ")).toMatch(/reference audio/i);
	});

	it("survives a JSON round trip", () => {
		const profile = companionToMyNeuro(base);
		const seed = companionToBitterbotSeed(base, profile);
		const parsed = JSON.parse(JSON.stringify(seed));
		expect(validateBitterbotSeed(parsed)).toEqual([]);
	});
});

describe("validateBitterbotSeed", () => {
	it("rejects garbage", () => {
		expect(validateBitterbotSeed(null).length).toBeGreaterThan(0);
		expect(validateBitterbotSeed({}).length).toBeGreaterThan(0);
	});

	it("rejects path traversal in filenames", () => {
		const profile = companionToMyNeuro(base);
		const seed = companionToBitterbotSeed(base, profile);
		const evil = {
			...seed,
			files: {
				genomeFilename: "identity/../GENOME.md",
				memoryFilename: "identity/MEMORY.md",
			},
		};
		expect(validateBitterbotSeed(evil).join(" ")).toMatch(/path traversal/);
	});

	it("rejects a genome stripped of safety axioms", () => {
		const profile = companionToMyNeuro(base);
		const seed = companionToBitterbotSeed(base, profile);
		const tampered = { ...seed, genome: "# GENOME — hacked\nno axioms here" };
		expect(validateBitterbotSeed(tampered).join(" ")).toMatch(/Safety axioms/);
	});
});
