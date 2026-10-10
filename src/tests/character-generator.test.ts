import { describe, expect, it, vi } from "vitest";
/**
 * Tests for one-click character generation (OpenPerso Phase 2).
 */

import { generateCharacterCard, validateGeneratedCard, CharacterGenError } from "@/lib/character-generator";

function jsonResponse(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

const GOOD_CARD = {
	name: "Luna",
	description: "A witty astronomer with silver hair who discovers comets for fun.",
	personality: "Curious, playful, quietly sentimental",
	scenario: "An observatory at midnight, stars overhead.",
	first_mes: "You made it! Look — the Perseids are starting.",
	mes_example: "<START>\n{{user}}: What's that star?\n{{char}}: That one? I named it Croissant.",
	creator_notes: "Astronomy-flavored companion.",
	system_prompt: "Stay in character as Luna. Be curious and warm.",
	tags: ["astronomy", "playful", "sci-fi"],
};

const VALID_INPUT = { name: "Luna", description: "a witty astronomer who names stars after desserts" };

describe("generateCharacterCard", () => {
	it("sends task+prompt to the server proxy and returns a validated card", async () => {
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ prompt: JSON.stringify(GOOD_CARD) }));
		const { card } = await generateCharacterCard({ ...VALID_INPUT, fetchImpl: fetchMock as unknown as typeof fetch });
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://api.privseai.com/v1/prompt/analyze");
		const body = JSON.parse(init.body as string);
		expect(body.task).toBe("character-card");
		expect(body.prompt).toContain("Luna");
		expect(card.spec).toBe("chara_card_v2");
		expect(card.data.first_mes).toContain("Perseids");
		expect(card.data.tags).toContain("astronomy");
	});

	it("strips markdown fences from model output", async () => {
		const fenced = "```json\n" + JSON.stringify(GOOD_CARD) + "\n```";
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ prompt: fenced }));
		const { card } = await generateCharacterCard({ ...VALID_INPUT, fetchImpl: fetchMock as unknown as typeof fetch });
		expect(card.data.name).toBe("Luna");
	});

	it("rejects invalid inputs before any request", async () => {
		const fetchMock = vi.fn();
		await expect(generateCharacterCard({ name: "", description: "long enough description here", fetchImpl: fetchMock as unknown as typeof fetch }))
			.rejects.toMatchObject({ code: "invalid-input" });
		await expect(generateCharacterCard({ name: "X", description: "short", fetchImpl: fetchMock as unknown as typeof fetch }))
			.rejects.toMatchObject({ code: "invalid-input" });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("maps provider errors", async () => {
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 503));
		await expect(generateCharacterCard({ ...VALID_INPUT, fetchImpl: fetchMock as unknown as typeof fetch }))
			.rejects.toMatchObject({ code: "provider-error" });
	});

	it("throws parse-failed for non-JSON content", async () => {
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ prompt: "Sorry, I cannot do that." }));
		await expect(generateCharacterCard({ ...VALID_INPUT, fetchImpl: fetchMock as unknown as typeof fetch }))
			.rejects.toMatchObject({ code: "parse-failed" });
	});
});

describe("validateGeneratedCard", () => {
	it("rejects cards missing required fields", () => {
		expect(() => validateGeneratedCard({ description: "too short" }, "X"))
			.toThrow(CharacterGenError);
		expect(() => validateGeneratedCard({ ...GOOD_CARD, personality: "" }, "X"))
			.toThrow(/missing required fields/);
	});

	it("falls back to input name when model omits it", () => {
		const card = validateGeneratedCard({ ...GOOD_CARD, name: "" }, "Fallback");
		expect(card.data.name).toBe("Fallback");
	});
});
