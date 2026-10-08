import { describe, it, expect } from "vitest";
import { CharacterCardParser } from "@/lib/character-card";
import { PersonalityEngine } from "@/lib/personality-engine";
import type { CharacterCard } from "@/types/character";

describe("CharacterCardParser", () => {
	it("parses valid JSON character card", () => {
		const json = JSON.stringify({
			spec: "chara_card_v2",
			data: {
				name: "Luna",
				description: "A warm and curious AI companion.",
				personality: "Warm, Curious, Gentle",
				tags: ["friend", "close"],
				extensions: { stage: "close" },
			},
		});

		const card = CharacterCardParser.parseJSON(json);
		expect(card.spec).toBe("chara_card_v2");
		expect(card.data.name).toBe("Luna");
	});

	it("parses legacy format (no spec)", () => {
		const json = JSON.stringify({
			name: "Aria",
			personality: "Playful, Attentive",
		});

		const card = CharacterCardParser.parseJSON(json);
		expect(card.data.name).toBe("Aria");
	});

	it("throws on missing name field", () => {
		const json = JSON.stringify({ spec: "chara_card_v2", data: { personality: "test" } });
		expect(() => CharacterCardParser.parseJSON(json)).toThrow("name");
	});

	it("converts card to CompanionProfile", () => {
		const card: CharacterCard = {
			spec: "chara_card_v2",
			data: {
				name: "TestChar",
				description: "A test companion, 25 years old.",
				personality: "Warm\nCurious",
				tags: ["friend", "artist"],
				creator: "test",
				creator_notes: "",
				scenario: "",
				first_mes: "",
				mes_example: "",
				system_prompt: "",
				post_scriptment: "",
				character_version: "1.0",
				src: "https://example.com/avatar.png",
				extensions: { stage: "close" },
			},
		};

		const profile = CharacterCardParser.cardToProfile(card);
		expect(profile.name).toBe("TestChar");
		expect(profile.id).toBe("testchar");
		expect(profile.age).toBe(25);
		expect(profile.occupation).toBeUndefined();
		expect(profile.personality).toEqual(["Warm", "Curious"]);
		expect(profile.stage).toBe(3); // "close" → index 3
	});

	it("determines stage from tags", () => {
		const card: CharacterCard = {
			spec: "chara_card_v2",
			data: {
				name: "Roma",
				description: "",
				personality: "",
				tags: ["romantic", "partner"],
				creator: "",
				creator_notes: "",
				scenario: "",
				first_mes: "",
				mes_example: "",
				system_prompt: "",
				post_scriptment: "",
				character_version: "1.0",
				src: "",
				extensions: {},
			},
		};

		const profile = CharacterCardParser.cardToProfile(card);
		expect(profile.stage).toBe(4); // partner → index 4
	});

	it("round-trips profile to card data", () => {
		const profile = {
			id: "test",
			name: "Test",
			bio: "Test bio",
			personality: ["Warm"],
			hobbies: ["reading"],
			relationship: "Friend",
			occupation: "Engineer",
			stage: 2,
		};

		const cardData = CharacterCardParser.profileToCard(profile);
		expect(cardData.name).toBe("Test");
		expect(cardData.description).toBe("Test bio");
		expect(cardData.personality).toBe("Warm");
		expect(cardData.tags).toContain("reading");
	});
});

describe("PersonalityEngine", () => {
	let engine: PersonalityEngine;

	beforeEach(() => {
		engine = new PersonalityEngine();
	});

	it("generates system prompt with personality traits", () => {
		const companion = {
			id: "luna",
			name: "Luna",
			bio: "A warm AI companion.",
			personality: ["Warm", "Curious"],
			hobbies: ["Stargazing"],
			occupation: "Illustrator",
			stage: 3,
		};

		const prompt = engine.generateSystemPrompt(
			companion as any,
			{ happiness: 0.7, intimacy: 0.5, trust: 0.6, arousal: 0.3, lastUpdate: Date.now() },
			"close",
		);

		expect(prompt).toContain("You are Luna");
		expect(prompt).toContain("Warm, Curious");
		expect(prompt).toContain("Close friend");
		expect(prompt).toContain("Happiness: 7.0/10");
		expect(prompt).toContain("Illustrator");
	});

	it("detects stage from companion profile", () => {
		const companion = { id: "test", name: "Test", stage: 4 } as any;
		const stage = engine.getStageFromRelationship(companion);
		expect(stage).toBe("partner");
	});

	it("updates emotions on message event", () => {
		const emotion = { ...DEFAULT_EMOTION_STATE };
		const updated = engine.updateEmotion({ type: "message" }, emotion);
		expect(updated.happiness).toBeGreaterThan(emotion.happiness);
		expect(updated.trust).toBeGreaterThan(emotion.trust);
		expect(updated.lastUpdate).toBeGreaterThan(0);
	});

	it("decreases emotions on ignore event", () => {
		const emotion = { ...DEFAULT_EMOTION_STATE };
		const updated = engine.updateEmotion({ type: "ignore" }, emotion);
		expect(updated.happiness).toBeLessThan(emotion.happiness);
		expect(updated.trust).toBeLessThan(emotion.trust);
	});

	it("increases intimacy on touch event", () => {
		const emotion = { ...DEFAULT_EMOTION_STATE };
		const updated = engine.updateEmotion({ type: "touch" }, emotion);
		expect(updated.intimacy).toBeGreaterThan(emotion.intimacy);
	});

	it("clamps emotions to 0-1 range", () => {
		const emotion = { ...DEFAULT_EMOTION_STATE, happiness: 0.99, intimacy: 0.99 };
		const updated = engine.updateEmotion({ type: "compliment" }, emotion);
		expect(updated.happiness).toBeLessThanOrEqual(1);
		expect(updated.intimacy).toBeLessThanOrEqual(1);
	});

	it("advances stage", () => {
		const companion = { id: "test", name: "Test", stage: 0 } as any;
		const next = engine.advanceStage(companion);
		expect(next).toBe("acquaintance");
	});
});

import { DEFAULT_EMOTION_STATE } from "@/types/character";
