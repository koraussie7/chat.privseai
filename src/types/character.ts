/**
 * Character Card types and parser for SillyTavern chara_card_v2 compatibility.
 * privseai.com supports importing .character cards from SillyTavern/MuhanAI ecosystem.
 */

export type CharacterSpec = "chara_card_v2" | "chara_card_v3";

export interface CharacterCardData {
	name: string;
	description: string;
	personality: string;
	scenario: string;
	first_mes: string;
	mes_example: string;
	creator_notes: string;
	system_prompt: string;
	post_scriptment: string;
	tags: string[];
	creator: string;
	character_version: string;
	src: string;
	extensions: Record<string, unknown>;
}

export interface CharacterCard {
	spec: CharacterSpec;
	data: CharacterCardData;
}

export interface ParsedCharacterCard {
	card: CharacterCard;
	image?: string;
	fileName: string;
}

export type CharacterStage =
	| "stranger"
	| "acquaintance"
	| "friend"
	| "close"
	| "partner"
	| "intimate";

export interface MemoryEntry {
	id: string;
	companionId: string;
	type: "fact" | "preference" | "relationship" | "experience";
	content: string;
	importance: number;
	createdAt: number;
	lastAccessed: number;
	expiresAt?: number;
}

export interface ConversationSummary {
	sessionId: string;
	companionId: string;
	summary: string;
	keyPoints: string[];
	entities: string[];
	timestamp: number;
	messageCount: number;
}

export interface EmotionState {
	happiness: number;
	intimacy: number;
	trust: number;
	arousal: number;
	lastUpdate: number;
}

export const DEFAULT_EMOTION_STATE: EmotionState = {
	happiness: 0.5,
	intimacy: 0.3,
	trust: 0.2,
	arousal: 0.3,
	lastUpdate: Date.now(),
};

export const STAGE_NAMES: Record<CharacterStage, string> = {
	stranger: "Stranger",
	acquaintance: "Acquaintance",
	friend: "Friend",
	close: "Close friend",
	partner: "Romantic partner",
	intimate: "Intimate",
};

export const STAGE_ORDER: CharacterStage[] = [
	"stranger",
	"acquaintance",
	"friend",
	"close",
	"partner",
	"intimate",
];
