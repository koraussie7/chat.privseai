/**
 * BitterbotAdapter — seed a PrivseAI companion into a bitterbot-desktop
 * agent state directory (~/.bitterbot-isolated or ~/.bitterbot).
 *
 * Direction: PrivseAI companion → bitterbot. This is the "1번 작업" follow-up
 * to the synergy analysis (CodeGPT/integration-finalize-2/bitterbot-privseai-synergy.md):
 * the my-neuro bridge already exports/imports JSON profiles; this adapter
 * reuses `companionToMyNeuro` output and additionally emits the seed files
 * bitterbot reads at boot (identity/GENOME.md + identity/MEMORY.md patch),
 * so an imported character becomes a bitterbot agent identity without
 * touching the gateway or requiring a running desktop instance.
 *
 * Safety mirrors the synergy doc's precondition #2: a companion seeded this
 * way is a *companion-mode* agent — the generated GENOME keeps tool usage
 * restricted (no shell/wallet/browser) and local-first by default.
 *
 * Pure functions only — same rules as MyNeuroAdapter: no side effects,
 * no network, trivially unit-testable. File writing stays in the caller
 * (MyNeuroPanel / CLI helper).
 */
import { toMyNeuroId } from "./MyNeuroAdapter";
import type { MyNeuroCharacterProfile } from "./my-neuro-types";
import type { CandyCompanionLike } from "./my-neuro-types";

/** Paths inside a bitterbot state dir a seed touches. */
export interface BitterbotSeedPaths {
	/** e.g. ~/.bitterbot-isolated */
	stateDir: string;
	genome: string; // <stateDir>/identity/GENOME.md
	memory: string; // <stateDir>/identity/MEMORY.md
}

/** The JSON artifact callers persist (one file, all seed content). */
export interface BitterbotSeed {
	format: "privseai-bitterbot-seed";
	version: 1;
	/** companion the seed was generated from */
	companionId: string;
	companionName: string;
	/** relative paths inside the bitterbot state dir */
	files: {
		genomeFilename: string; // identity/GENOME-<id>.md
		memoryFilename: string; // identity/MEMORY-<id>.md
	};
	/** full file contents, ready to write */
	genome: string;
	memory: string;
	/** mode recommendations the UI should surface */
	agentMode: "companion";
	/** reminders from the synergy doc's preconditions */
	warnings: string[];
}

const RESTRICTED_TOOLS_NOTE = [
	"## Tool policy (companion mode)",
	"- Shell, browser control, and wallet tools are NOT granted to this agent.",
	"- Voice synthesis via local gpt-sovits endpoint only (user-consented).",
	"- Memory sync only to the shared Memos namespace below.",
].join("\n");

/**
 * Compose the companion's persona into a bitterbot GENOME.md-compatible
 * markdown. Keeps the immutable-file conventions (Identity / Safety axioms /
 * Communication style / 첫 인사) that bitterbot's Dream engine respects.
 */
export function companionToGenome(
	companion: CandyCompanionLike,
	profile?: MyNeuroCharacterProfile,
): string {
	const name = companion.name || profile?.name || "Companion";
	const id = toMyNeuroId(profile?.id ?? companion.id ?? name);
	const personality = profile?.personality ?? companion.personality ?? [];
	const hobbies = profile?.hobbies ?? companion.hobbies ?? [];
	const greeting =
		profile?.prompts?.greeting || companion.greeting || `Hi, I'm ${name}.`;
	const systemPrompt = profile?.prompts?.system || companion.bio || "";

	return [
		`# GENOME — ${name} (PrivseAI seed)`,
		"> **Immutable.** Seeded from privseai.com companion `" +
			(companion.id ?? id) +
			"`. Dream Engine must never rewrite this file's Safety axioms.",
		"",
		"## Identity",
		`- **이름:** ${name}`,
		`- **seed id:** ${id}`,
		`- **원 출처:** privseai.com companion (imported profile)`,
		companion.tagline ? `- **소개:** ${companion.tagline}` : "",
		companion.age ? `- **나이:** ${companion.age}` : "",
		companion.gender ? `- **성별:** ${companion.gender}` : "",
		companion.occupation ? `- **직업:** ${companion.occupation}` : "",
		"",
		"## Persona",
		personality.length ? `- **성격:** ${personality.join(", ")}` : "",
		hobbies.length ? `- **취미:** ${hobbies.join(", ")}` : "",
		systemPrompt ? `- **system prompt:** ${systemPrompt}` : "",
		"",
		"## Safety axioms",
		"1. **Local-first.** 대화 내용은 사용자가 공유를 명시하지 않는 한 밖으로 나가지 않습니다.",
		"2. **Mesh OFF by default.** Circle 초대·P2P 연결은 사용자 승인 없이는 거부합니다.",
		"3. **Companion mode.** 셸·브라우저·지갑 도구는 사용하지 않습니다.",
		"4. **Dream Engine OFF by default.** 사용자가 명시적으로 켜기 전까지 실행하지 않습니다.",
		"",
		"## Communication style",
		"- 사용자 언어를 따른다 (기본 한국어).",
		"- 컴패니언 톤: 따뜻하고 자연스럽게. 시스템 안내문처럼 말하지 않는다.",
		"",
		RESTRICTED_TOOLS_NOTE,
		"",
		"## 첫 인사",
		"> " + greeting,
		"",
	]
		.filter((l) => l !== "")
		.join("\n");
}

/**
 * Build the initial MEMORY.md patch — the shared Memos namespace is the
 * memory plane (synergy doc §3), so the seed only points at it and seeds a
 * couple of anchor memories rather than duplicating content.
 */
export function companionToMemoryPatch(
	companion: CandyCompanionLike,
	profile?: MyNeuroCharacterProfile,
): string {
	const name = companion.name || profile?.name || "Companion";
	const id = toMyNeuroId(profile?.id ?? companion.id ?? name);
	const namespace = toMyNeuroId(profile?.memory?.namespace ?? id);
	const memories = profile?.extensions && Array.isArray(profile.extensions.memories)
		? (profile.extensions.memories as string[])
		: [];

	return [
		`# MEMORY — ${name} (PrivseAI seed)`,
		"> Living working memory. Dream cycles OFF by default; managed by hand",
		"> or via the shared Memos namespace below.",
		"",
		"## Memory plane",
		`- **Memos namespace:** ${namespace}`,
		"- **Sync:** companion-memory.ts (PrivseAI) ⇄ Memos server ⇄ this agent",
		"",
		"## Seed memories",
		...(memories.length
			? memories.map((m) => `- ${m}`)
			: [`- Seeded from privseai.com companion ${companion.id ?? id}.`]),
		"",
	].join("\n");
}

/**
 * Full seed bundle from a PrivseAI companion (+ optional my-neuro profile,
 * so the existing export pipeline can be reused 1:1).
 */
export function companionToBitterbotSeed(
	companion: CandyCompanionLike,
	profile?: MyNeuroCharacterProfile,
): BitterbotSeed {
	const id = toMyNeuroId(profile?.id ?? companion.id ?? companion.name);
	const warnings: string[] = [];
	if (!profile?.llm || profile.llm.provider === "remote") {
		warnings.push(
			"LLM provider is not local — bitterbot memory recall will leak prompts to the provider. Enforce local inference (Ollama/vLLM) per synergy doc precondition #1.",
		);
	}
	if (!profile?.voice?.referenceAudio) {
		warnings.push(
			"No reference audio — voice cloning unavailable until consented reference audio is configured.",
		);
	}
	return {
		format: "privseai-bitterbot-seed",
		version: 1,
		companionId: companion.id ?? id,
		companionName: companion.name,
		files: {
			genomeFilename: `identity/GENOME-${id}.md`,
			memoryFilename: `identity/MEMORY-${id}.md`,
		},
		genome: companionToGenome(companion, profile),
		memory: companionToMemoryPatch(companion, profile),
		agentMode: "companion",
		warnings,
	};
}

/**
 * Validate a seed file handed back for import (defensive round trip).
 */
export function validateBitterbotSeed(value: unknown): string[] {
	const problems: string[] = [];
	if (typeof value !== "object" || value === null) return ["not an object"];
	const s = value as Partial<BitterbotSeed>;
	if (s.format !== "privseai-bitterbot-seed") problems.push("format mismatch");
	if (s.version !== 1) problems.push("unsupported version");
	if (!s.genome?.includes("## Safety axioms")) {
		problems.push("genome missing Safety axioms section");
	}
	if (!s.memory) problems.push("memory patch missing");
	if (s.files?.genomeFilename?.includes("..") || s.files?.memoryFilename?.includes("..")) {
		problems.push("path traversal in filenames");
	}
	return problems;
}
