/**
 * One-click character generation — OpenPerso Phase 2 concept.
 *
 * Flow: user gives name + short description → server prompt API (gemini-2.5-flash)
 * returns a complete SillyTavern chara_card_v2 → validated → AIHub package.
 *
 * The server proxy (server/prompt-proxy.py) accepts a "task" extension:
 * task="character-card" produces JSON matching CharacterCardData.
 */

import type { CharacterCard } from "@/types/character";

const ANALYZE_ENDPOINT = "https://api.privseai.com/v1/prompt/analyze";
const MAX_DESC = 2000;

export interface CharacterGenInput {
	name: string;
	description: string;
	signal?: AbortSignal;
	fetchImpl?: typeof fetch;
}

export interface CharacterGenResult {
	card: CharacterCard;
}

export class CharacterGenError extends Error {
	constructor(
		message: string,
		public readonly code: "invalid-input" | "provider-error" | "parse-failed" | "validation-failed",
	) {
		super(message);
		this.name = "CharacterGenError";
	}
}

function buildInstruction(name: string, description: string): string {
	return [
		`Create a complete roleplay character card for a companion named "${name}".`,
		`User description: ${description}`,
		"",
		"Return ONLY a JSON object (no markdown fences, no preamble) with these exact keys:",
		'{ "name": string, "description": string (2-4 sentences, third person, appearance + role),',
		'  "personality": string (3-5 traits with brief explanation), "scenario": string (1-2 sentences setting),',
		'  "first_mes": string (greeting in character, 1-3 sentences), "mes_example": string (2 example exchanges, format: <START>\\n{{user}}: ...\\n{{char}}: ...),',
		'  "creator_notes": string (1 sentence), "system_prompt": string (roleplay instructions addressing the model, 3-6 sentences, include staying in character and the personality summary),',
		'  "tags": string[] (3-6 lowercase tags), "post_scriptment": string (empty string ok),',
		'  "mes_example" must use the literal tokens {{user}} and {{char}}.',
		"Write all prose in the same language as the user description.",
	].join("\n");
}

interface RawCard {
	name?: unknown;
	description?: unknown;
	personality?: unknown;
	scenario?: unknown;
	first_mes?: unknown;
	mes_example?: unknown;
	creator_notes?: unknown;
	system_prompt?: unknown;
	post_scriptment?: unknown;
	tags?: unknown;
}

function extractJson(text: string): RawCard {
	const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
	const start = trimmed.indexOf("{");
	const end = trimmed.lastIndexOf("}");
	if (start === -1 || end === -1 || end <= start) {
		throw new CharacterGenError("Model did not return JSON.", "parse-failed");
	}
	try {
		return JSON.parse(trimmed.slice(start, end + 1)) as RawCard;
	} catch {
		throw new CharacterGenError("Model returned malformed JSON.", "parse-failed");
	}
}

const asStr = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const asTags = (v: unknown): string[] =>
	Array.isArray(v) ? v.filter((t): t is string => typeof t === "string").map((t) => t.toLowerCase().trim()).filter(Boolean).slice(0, 8) : [];

export function validateGeneratedCard(raw: RawCard, fallbackName: string): CharacterCard {
	const name = asStr(raw.name) || fallbackName;
	const description = asStr(raw.description);
	const personality = asStr(raw.personality);
	const scenario = asStr(raw.scenario);
	const firstMes = asStr(raw.first_mes);
	const systemPrompt = asStr(raw.system_prompt);
	if (!description || description.length < 20) {
		throw new CharacterGenError("Generated description is too short or missing.", "validation-failed");
	}
	if (!personality || !scenario || !firstMes || !systemPrompt) {
		throw new CharacterGenError("Generated card is missing required fields.", "validation-failed");
	}
	return {
		spec: "chara_card_v2",
		data: {
			name,
			description,
			personality,
			scenario,
			first_mes: firstMes,
			mes_example: asStr(raw.mes_example),
			creator_notes: asStr(raw.creator_notes),
			system_prompt: systemPrompt,
			post_scriptment: asStr(raw.post_scriptment),
			tags: asTags(raw.tags),
			creator: "prompt-studio",
			character_version: "1.0.0",
			src: "privseai://one-click",
			extensions: {},
		},
	};
}

/** Generate a full character card via the server proxy. */
export async function generateCharacterCard(
	input: CharacterGenInput,
): Promise<CharacterGenResult> {
	const name = input.name.trim();
	const description = input.description.trim();
	if (!name || name.length > 40) {
		throw new CharacterGenError("Enter a name (1-40 characters).", "invalid-input");
	}
	if (!description || description.length < 10) {
		throw new CharacterGenError("Describe the character in at least 10 characters.", "invalid-input");
	}
	if (description.length > MAX_DESC) {
		throw new CharacterGenError(`Description must be under ${MAX_DESC} characters.`, "invalid-input");
	}
	const fetchImpl = input.fetchImpl ?? fetch;
	let response: Response;
	try {
		response = await fetchImpl(ANALYZE_ENDPOINT, {
			method: "POST",
			signal: input.signal,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				mode: "enhance-image",
				task: "character-card",
				prompt: buildInstruction(name, description),
				model: "gemini-2.5-flash",
			}),
		});
	} catch (error) {
		if (input.signal?.aborted) throw error;
		throw new CharacterGenError("Could not reach the character generation service.", "provider-error");
	}
	if (!response.ok) {
		throw new CharacterGenError(`Character generation failed (HTTP ${response.status}).`, "provider-error");
	}
	const json = (await response.json()) as { prompt?: string };
	const text = json.prompt ?? "";
	if (!text) throw new CharacterGenError("Generation service returned no content.", "provider-error");
	const card = validateGeneratedCard(extractJson(text), name);
	return { card };
}
