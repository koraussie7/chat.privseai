/**
 * Types for the my-neuro (github.com/morettt/my-neuro) interoperability layer.
 *
 * These are intentionally loose where my-neuro's own schema may evolve:
 * unknown fields ride along in `extensions` so nothing is lost on a round trip.
 */

/** The subset of a PrivseAI companion the adapter actually reads. */
export interface CandyCompanionLike {
	id: string;
	name: string;
	tagline?: string;
	age?: number;
	category?: "realistic" | "anime" | string;
	gender?: "female" | "male" | string;
	avatarUrl?: string;
	bio?: string;
	relationship?: string;
	occupation?: string;
	hobbies?: string[];
	personality?: string[];
	stage?: number;
	greeting?: string;
	voiceAudioUrl?: string;
	isOnline?: boolean;
	hasVoice?: boolean;
	isPopular?: boolean;
	bannerUrl?: string;
	gallery?: unknown[];
	scenarios?: unknown[];
}

export interface MyNeuroVoiceConfig {
	/** e.g. "gpt-sovits" | "azure" | "none" */
	engine: string;
	/** speaker/voice id understood by the TTS engine */
	speaker?: string;
	/** local reference audio path or http(s) URL used for voice cloning */
	referenceAudio?: string;
}

export interface MyNeuroLlmConfig {
	provider: "local" | "remote" | "ollama" | "llamacpp";
	model: string;
	endpoint?: string;
}

export interface MyNeuroMemoryConfig {
	enabled: boolean;
	/** shared namespace so multiple devices can sync the same memory */
	namespace: string;
}

export interface MyNeuroPrompts {
	system: string;
	greeting?: string;
	examples?: string[];
}

export interface MyNeuroCharacterProfile {
	/** stable id when known; otherwise derived from the name */
	id?: string;
	name: string;
	gender?: string;
	age?: number;
	personality?: string[];
	hobbies?: string[];
	avatar?: string;
	/** path to a Live2D model inside the my-neuro install, if any */
	live2dModel?: string;
	voice?: MyNeuroVoiceConfig;
	llm?: MyNeuroLlmConfig;
	memory?: MyNeuroMemoryConfig;
	prompts?: MyNeuroPrompts;
	/** expression/emotion presets keyed by emotion name */
	emotions?: Record<string, string>;
	/** arbitrary pass-through fields */
	extensions?: Record<string, unknown>;
}

export interface MyNeuroImportResult {
	companion: CandyCompanionLike;
	/** non-fatal issues worth surfacing to the user */
	warnings: string[];
	/** my-neuro-only fields preserved for a future export */
	myNeuroExtensions: Record<string, unknown>;
}
