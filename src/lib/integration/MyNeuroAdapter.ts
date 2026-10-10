/**
 * MyNeuroAdapter — bridge PrivseAI companions/packages to the my-neuro
 * desktop-companion format and back.
 *
 * my-neuro (github.com/morettt/my-neuro) is an Electron + Python AI desktop
 * companion with gpt-sovits voice, Live2D, long-term memory and local LLM
 * support. Rather than merging the two codebases (different runtimes), we
 * exchange a JSON "my-neuro character profile" so characters, prompts and
 * model recipes can move between the web P2P app and the desktop app.
 *
 * Design notes:
 *  - Pure functions, no side effects, no network. Safe to unit test.
 *  - We never copy my-neuro code; this is a format adapter only.
 *  - Fields PrivseAI does not model (live2d model path, sub-settings) are
 *    carried through `extensions`/`myNeuro` so round-trips are lossless.
 */
import type {
	CandyCompanionLike,
	MyNeuroCharacterProfile,
	MyNeuroImportResult,
} from "./my-neuro-types";

const DEFAULT_MODEL = "qwen2.5-7b-instruct";
const DEFAULT_TTS_MODEL = "gpt-sovits";

/** Sensible defaults a my-neuro profile needs even if PrivseAI has no value. */
function defaultProfile(name: string): MyNeuroCharacterProfile {
	return {
		name,
		live2dModel: "",
		voice: { engine: "gpt-sovits", speaker: name, referenceAudio: "" },
		llm: { provider: "local", model: DEFAULT_MODEL, endpoint: "" },
		memory: { enabled: true, namespace: name },
		prompts: { system: "", greeting: "", examples: [] },
		emotions: {},
		extensions: {},
	};
}

/** Sanitize a string into a my-neuro-safe identifier (namespace/speaker). */
export function toMyNeuroId(raw: string): string {
	const cleaned = raw
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return cleaned || "companion";
}

/**
 * PrivseAI companion (CandyCompanion-shaped) → my-neuro profile.
 */
export function companionToMyNeuro(
	companion: CandyCompanionLike,
): MyNeuroCharacterProfile {
	const base = defaultProfile(companion.name);
	const systemPrompt = [
		`You are ${companion.name}, ${companion.tagline}.`,
		companion.bio,
		companion.personality?.length
			? `Personality: ${companion.personality.join(", ")}.`
			: "",
		companion.occupation ? `Occupation: ${companion.occupation}.` : "",
		"Stay in character. Reply naturally and keep continuity with prior messages.",
	]
		.filter(Boolean)
		.join(" ");

	return {
		...base,
		name: companion.name,
		id: companion.id,
		gender: companion.gender,
		age: companion.age,
		personality: companion.personality ?? [],
		hobbies: companion.hobbies ?? [],
		voice: {
			engine: DEFAULT_TTS_MODEL,
			speaker: toMyNeuroId(companion.name),
			referenceAudio: companion.voiceAudioUrl ?? "",
		},
		llm: { provider: base.llm?.provider ?? "local", model: base.llm?.model ?? DEFAULT_MODEL, endpoint: base.llm?.endpoint },
		// A shared namespace lets several devices sync the same memory later.
		memory: { enabled: true, namespace: toMyNeuroId(companion.id) },
		prompts: {
			system: systemPrompt,
			greeting: companion.greeting ?? "",
			examples: [],
		},
		avatar: companion.avatarUrl,
		extensions: {
			...(companion.category ? { category: companion.category } : {}),
			...(companion.relationship ? { relationship: companion.relationship } : {}),
			...(companion.stage !== undefined ? { stage: companion.stage } : {}),
		},
	};
}

/**
 * my-neuro profile → a PrivseAI companion patch.
 *
 * We only return fields PrivseAI owns; callers merge this onto an existing
 * companion or use it to build a new one. Unknown my-neuro fields are kept
 * under `myNeuroExtensions` so a later export can restore them.
 */
export function myNeuroToCompanion(
	profile: MyNeuroCharacterProfile,
): MyNeuroImportResult {
	const warnings: string[] = [];
	if (!profile.name) warnings.push("profile.name missing — import may be unusable");
	if (!profile.prompts?.system) {
		warnings.push("profile.prompts.system missing — using a generic persona");
	}

	const greeting = profile.prompts?.greeting ?? "";
	const personality = profile.personality?.length
		? profile.personality
		: derivePersonality(profile.prompts?.system ?? "");

	return {
		companion: {
			id: profile.id ?? toMyNeuroId(profile.name),
			name: profile.name,
			tagline: profile.extensions?.tagline
				? String(profile.extensions.tagline)
				: `${profile.name} — imported from my-neuro`,
			age: profile.age ?? 0,
			category: deriveCategory(profile),
			gender: profile.gender ?? "female",
			isOnline: false,
			hasVoice: Boolean(profile.voice?.referenceAudio || profile.voice?.speaker),
			avatarUrl: profile.avatar ?? "",
			bio: profile.prompts?.system
				? truncate(profile.prompts.system, 280)
				: "Imported from my-neuro.",
			relationship: "Close Friend",
			occupation: profile.extensions?.occupation
				? String(profile.extensions.occupation)
				: "",
			hobbies: profile.hobbies ?? [],
			personality,
			stage: 1,
			greeting: greeting || `Hi, I'm ${profile.name}.`,
			voiceAudioUrl: profile.voice?.referenceAudio || undefined,
			gallery: [],
			scenarios: [],
		},
		warnings,
		myNeuroExtensions: {
			live2dModel: profile.live2dModel,
			voiceEngine: profile.voice?.engine,
			llm: profile.llm,
			memory: profile.memory,
			emotions: profile.emotions,
		},
	};
}

/** Best-effort personality extraction when my-neuro supplies only a prompt. */
function derivePersonality(systemPrompt: string): string[] {
	const m = systemPrompt.match(/personality[:\-]\s*([^.\n]+)/i);
	if (!m) return ["Friendly", "Curious"];
	return m[1]
		.split(/[,/]/)
		.map((s) => s.trim())
		.filter(Boolean)
		.slice(0, 5);
}

/** my-neuro has no category field; default to realistic unless told otherwise. */
function deriveCategory(profile: MyNeuroCharacterProfile): "anime" | "realistic" {
	const raw = String(profile.extensions?.category ?? "").toLowerCase();
	if (raw.includes("anime") || profile.live2dModel?.toLowerCase().includes("live2d")) {
		return "anime";
	}
	return "realistic";
}

function truncate(text: string, max: number): string {
	const clean = text.replace(/\s+/g, " ").trim();
	return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** Round-trip helper: import a my-neuro profile, patch, and export again. */
export function roundTripMyNeuro(
	profile: MyNeuroCharacterProfile,
): MyNeuroCharacterProfile {
	const { companion } = myNeuroToCompanion(profile);
	const exported = companionToMyNeuro(companion);
	// Preserve original my-neuro-only fields through the round trip.
	return {
		...exported,
		live2dModel: profile.live2dModel || exported.live2dModel,
		emotions: { ...profile.emotions, ...exported.emotions },
		extensions: { ...profile.extensions, ...exported.extensions },
	};
}

/**
 * Validate a my-neuro profile before importing. Returns a list of problems;
 * empty means the profile is safe to use.
 */
export function validateMyNeuroProfile(
	profile: Partial<MyNeuroCharacterProfile> | null | undefined,
): string[] {
	const problems: string[] = [];
	if (!profile || typeof profile !== "object") {
		return ["profile is not an object"];
	}
	if (!profile.name || typeof profile.name !== "string") {
		problems.push("name is required");
	}
	if (profile.age !== undefined && (profile.age < 0 || profile.age > 200)) {
		problems.push("age out of range");
	}
	if (profile.voice?.referenceAudio && !isSafeUrl(profile.voice.referenceAudio)) {
		problems.push("voice.referenceAudio must be a local path or http(s) URL");
	}
	if (profile.llm?.endpoint && !isSafeUrl(profile.llm.endpoint)) {
		problems.push("llm.endpoint must be http(s)");
	}
	return problems;
}

/** Reject javascript:/data: URIs and other unexpected schemes. */
function isSafeUrl(value: string): boolean {
	if (/^https?:\/\//i.test(value)) return true;
	if (value.startsWith("/")) return true; // absolute local path
	if (/^[a-zA-Z]:[\\/]/.test(value)) return true; // windows drive path
	return false;
}
