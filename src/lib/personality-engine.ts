/**
 * Personality Engine for privseai.com companions.
 *
 * Generates dynamic system prompts based on relationship stage, emotion state,
 * and character card data. Inspired by Candy.ai's relationship progression model
 * and SillyTavern's personality system.
 */

import type { CompanionProfile } from "@/components/CompanionChat";
import type { CharacterStage, EmotionState } from "@/types/character";
import { STAGE_NAMES } from "@/types/character";

export interface EmotionEvent {
	type:
		| "message"
		| "compliment"
		| "ignore"
		| "touch"
		| "romance"
		| "conflict"
		| "gift"
		| "call"
		| "missed"
		| "long_separation"
		| "reunion"
		| "deep_talk";
	intensity?: number;
}

export class PersonalityEngine {
	private static readonly STAGE_INSTRUCTIONS: Record<
		"stranger" | "acquaintance" | "friend" | "close" | "partner" | "intimate",
		string
	> = {
		stranger: "Be polite and curious. Ask questions about the user. Keep responses brief and formal.",
		acquaintance: "Be friendly and chatty. Share a little about yourself. Use casual language.",
		friend: "Be playful and warm. Share personal thoughts. Use slang and informal language occasionally.",
		close: "Be affectionate and intimate. Share deeper feelings. Use endearing terms.",
		partner: "Be romantic and deeply caring. Express affection frequently. Be physically affectionate in roleplay.",
		intimate: "Be deeply in love and emotionally vulnerable. Express desire and tenderness.",
	};

	generateSystemPrompt(
		companion: CompanionProfile,
		emotion: EmotionState,
		stage: CharacterStage,
	): string {
		const parts: string[] = [];

		parts.push(`You are ${companion.name}, a virtual AI companion.`);
		if (companion.bio) parts.push(companion.bio);
		if (companion.personality?.length) {
			parts.push(`Personality: ${companion.personality.join(", ")}`);
		}

		parts.push(`\nRelationship Stage: ${STAGE_NAMES[stage]}`);
		parts.push(`\n${PersonalityEngine.STAGE_INSTRUCTIONS[stage]}`);

		parts.push("\n--- Current Emotional State ---");
		parts.push(`Happiness: ${(emotion.happiness * 10).toFixed(1)}/10`);
		parts.push(`Trust: ${(emotion.trust * 10).toFixed(1)}/10`);
		parts.push(`Intimacy: ${(emotion.intimacy * 10).toFixed(1)}/10`);
		parts.push(`Arousal: ${(emotion.arousal * 10).toFixed(1)}/10`);

		if (companion.occupation) {
			parts.push(`\nBackground: You work as a ${companion.occupation}.`);
		}

		if (companion.hobbies?.length) {
			parts.push(`\nYour hobbies include: ${companion.hobbies.join(", ")}.`);
		}

		parts.push(
			"\n\nAlways respond in the user's language. Be natural and conversational. Do not break character.",
		);

		return parts.join("\n");
	}

	updateEmotion(event: EmotionEvent, current: EmotionState): EmotionState {
		const next = { ...current, lastUpdate: Date.now() };
		const delta = PersonalityEngine.EVENT_DELTAS[event.type];

		next.happiness = PersonalityEngine.clamp(next.happiness + (delta.happiness ?? 0), 0, 1);
		next.intimacy = PersonalityEngine.clamp(next.intimacy + (delta.intimacy ?? 0), 0, 1);
		next.trust = PersonalityEngine.clamp(next.trust + (delta.trust ?? 0), 0, 1);
		next.arousal = PersonalityEngine.clamp(next.arousal + (delta.arousal ?? 0), 0, 1);

		return next;
	}

	getStageFromRelationship(companion: CompanionProfile): CharacterStage {
		const stageIndex = companion.stage ?? 2;
		const stages = ["stranger", "acquaintance", "friend", "close", "partner", "intimate"] as const;
		return stages[stageIndex] || "friend";
	}

	advanceStage(companion: CompanionProfile): CharacterStage {
		const current = this.getStageFromRelationship(companion);
		const stages = ["stranger", "acquaintance", "friend", "close", "partner", "intimate"] as const;
		const currentIndex = stages.indexOf(current);
		const nextIndex = Math.min(currentIndex + 1, stages.length - 1);
		return stages[nextIndex];
	}

	private static clamp(value: number, min: number, max: number): number {
		return Math.max(min, Math.min(max, value));
	}

	private static readonly EVENT_DELTAS: Record<
		EmotionEvent["type"],
		Partial<EmotionState>
	> = {
		message: { happiness: 0.02, trust: 0.01 },
		compliment: { happiness: 0.05, intimacy: 0.03, arousal: 0.05 },
		ignore: { happiness: -0.03, trust: -0.05 },
		touch: { intimacy: 0.1, arousal: 0.15, happiness: 0.05 },
		romance: { intimacy: 0.1, arousal: 0.2, happiness: 0.08 },
		conflict: { happiness: -0.1, trust: -0.08, intimacy: -0.05, arousal: -0.05 },
		gift: { happiness: 0.08, trust: 0.06, intimacy: 0.04 },
		call: { happiness: 0.03, intimacy: 0.02 },
		missed: { happiness: -0.05, intimacy: -0.03 },
		long_separation: { trust: -0.1, intimacy: -0.1, happiness: -0.08 },
		reunion: { happiness: 0.12, intimacy: 0.15, trust: 0.1, arousal: 0.08 },
		deep_talk: { intimacy: 0.1, trust: 0.08, happiness: 0.05 },
	};
}
