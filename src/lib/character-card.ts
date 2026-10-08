/**
 * Character card parser and converter for SillyTavern chara_card_v2/v3 compatibility.
 *
 * Supports:
 * - .character (JSON) files
 * - PNG/JPEG with embedded character card metadata (PNG chunk: "chara")
 * - SillyTavern extension fields (scenario, first_mes, etc.)
 */

import type {
	CharacterCard,
	CharacterCardData,
	CharacterStage,
	ParsedCharacterCard,
} from "@/types/character";
import { STAGE_ORDER } from "@/types/character";
import type { CompanionProfile } from "@/components/CompanionChat";

const REQUIRED_FIELDS = ["name"] as const;

const STAGE_TAG_MAP: Record<string, CharacterStage> = {
	stranger: "stranger",
	acquaintance: "acquaintance",
	friend: "friend",
	close: "close",
	partner: "partner",
	intimate: "intimate",
	girlfriend: "partner",
	boyfriend: "partner",
	wife: "intimate",
	husband: "intimate",
	love: "intimate",
	date: "partner",
};

export class CharacterCardParser {
	/**
	 * Parse a character card from a JSON string.
	 */
	static parseJSON(json: string): CharacterCard {
		const parsed = JSON.parse(json);

		if (parsed.spec && ["chara_card_v2", "chara_card_v3"].includes(parsed.spec)) {
			if (!parsed.data) {
				throw new Error("Character card missing 'data' field");
			}
			return {
				spec: parsed.spec,
				data: CharacterCardParser.normalizeData(parsed.data),
			};
		}

		if (parsed.data && parsed.data.name) {
			return {
				spec: "chara_card_v2",
				data: CharacterCardParser.normalizeData(parsed.data),
			};
		}

		return {
			spec: "chara_card_v2",
			data: CharacterCardParser.normalizeData(parsed),
		};
	}

	/**
	 * Parse a character card from a PNG file with embedded "chara" chunk.
	 * PNG character cards use base64-encoded JSON in a custom chunk.
	 */
	static async parseImage(file: File): Promise<ParsedCharacterCard> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = (e) => {
				try {
					const arrayBuf = e.target?.result as ArrayBuffer;
					if (!arrayBuf) {
						reject(new Error("Failed to read file"));
						return;
					}

					const view = new DataView(arrayBuf);
					const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

					let isPng = true;
					for (let i = 0; i < pngSignature.length; i++) {
						if (view.getUint8(i) !== pngSignature[i]) {
							isPng = false;
							break;
						}
					}

					if (!isPng) {
						reject(new Error("Not a valid PNG file"));
						return;
					}

					let offset = pngSignature.length;
					let found = false;

					while (offset < view.byteLength && !found) {
						const length = view.getUint32(offset);
						const chunkType = new TextDecoder().decode(
							new Uint8Array(arrayBuf, offset + 4, 4),
						);

						if (chunkType === "caID" || chunkType === "chara") {
							const chunkData = new Uint8Array(arrayBuf, offset + 8, length);
							const jsonStr = new TextDecoder().decode(chunkData);
							const parsed = JSON.parse(jsonStr);

							const card: CharacterCard = parsed.spec
								? { spec: parsed.spec, data: CharacterCardParser.normalizeData(parsed.data) }
								: { spec: "chara_card_v2", data: CharacterCardParser.normalizeData(parsed) };

							const imageData = CharacterCardParser.extractBase64Image(arrayBuf);

							resolve({
								card,
								image: imageData,
								fileName: file.name,
							});
							found = true;
						} else {
							offset += 8 + length + 4;
						}
					}

					if (!found) {
						resolve({
							card: CharacterCardParser.createDefaultCard(file.name),
							image: CharacterCardParser.extractBase64Image(arrayBuf),
							fileName: file.name,
						});
					}
				} catch (err) {
					reject(err instanceof Error ? err : new Error(String(err)));
				}
			};
			reader.onerror = () => reject(new Error("FileReader error"));
			reader.readAsArrayBuffer(file);
		});
	}

	/**
	 * Parse any file type (JSON or image with metadata).
	 */
	static async parseFile(file: File): Promise<ParsedCharacterCard> {
		const text = await file.text();

		const firstBrace = text.indexOf("{");
		if (firstBrace >= 0 && firstBrace < 100) {
			try {
				return {
					card: CharacterCardParser.parseJSON(text.slice(firstBrace)),
					image: text.slice(0, firstBrace),
					fileName: file.name,
				};
			} catch {
				// Not JSON, try as image
			}
		}

		if (file.type.startsWith("image/")) {
			return CharacterCardParser.parseImage(file);
		}

		throw new Error(`Unsupported file type: ${file.type}`);
	}

	/**
	 * Convert a CharacterCard to CompanionProfile.
	 */
	static cardToProfile(card: CharacterCard): CompanionProfile {
		const data = card.data;
		const tags = data.tags || [];
		const stage = CharacterCardParser.determineStage(tags, data.extensions);

		const personality = data.personality
			? data.personality.split("\n").filter(Boolean)
			: [];

		const hobbies = data.tags
			? data.tags.filter((t) => !STAGE_TAG_MAP[t.toLowerCase()]).slice(0, 4)
			: [];

		return {
			id: data.name.toLowerCase().replace(/\s+/g, "-"),
			name: data.name,
			age: CharacterCardParser.extractAge(data.description),
			avatarUrl: data.src || "",
			gallery: [],
			bio: data.description || data.creator_notes || "",
			relationship: CharacterCardParser.determineRelationship(stage),
			occupation: CharacterCardParser.extractOccupation(data.description),
			hobbies: hobbies.length > 0 ? hobbies : undefined,
			personality: personality.length > 0 ? personality : undefined,
			stage: STAGE_ORDER.indexOf(stage),
		};
	}

	/**
	 * Convert a CompanionProfile back to CharacterCard data.
	 */
	static profileToCard(profile: CompanionProfile): CharacterCardData {
		return {
			name: profile.name,
			description: profile.bio || "",
			personality: profile.personality?.join(", ") || "",
			scenario: profile.relationship || "",
			first_mes: `안녕, 난 ${profile.name}. 오늘 하루는 어땠어?`,
			mes_example: "",
			creator_notes: "",
			system_prompt: "",
			post_scriptment: "",
			tags: [...(profile.hobbies || []), profile.relationship || "companion"],
			creator: "MuhanAI",
			character_version: "1.0",
			src: profile.avatarUrl || "",
			extensions: {
				stage: profile.stage === undefined ? "friend" : STAGE_ORDER[profile.stage] || "friend",
				occupation: profile.occupation,
				age: profile.age?.toString(),
			},
		};
	}

	static createDefaultCard(name: string): CharacterCard {
		return {
			spec: "chara_card_v2",
			data: {
				name,
				description: "",
				personality: "",
				scenario: "",
				first_mes: "",
				mes_example: "",
				creator_notes: "",
				system_prompt: "",
				post_scriptment: "",
				tags: ["companion"],
				creator: "PrivseAI",
				character_version: "1.0",
				src: "",
				extensions: {},
			},
		};
	}

	private static normalizeData(data: Partial<CharacterCardData>): CharacterCardData {
		for (const field of REQUIRED_FIELDS) {
			if (!data[field]) {
				throw new Error(`Character card missing required field: ${field}`);
			}
		}

		return {
			name: data.name || "Unknown",
			description: data.description || "",
			personality: data.personality || "",
			scenario: data.scenario || "",
			first_mes: data.first_mes || "",
			mes_example: data.mes_example || "",
			creator_notes: data.creator_notes || "",
			system_prompt: data.system_prompt || "",
			post_scriptment: data.post_scriptment || "",
			tags: data.tags || [],
			creator: data.creator || "Unknown",
			character_version: data.character_version || "1.0",
			src: data.src || "",
			extensions: data.extensions || {},
		};
	}

	private static determineStage(
		tags: string[],
		extensions?: Record<string, unknown>,
	): CharacterStage {
		const stageExt = extensions?.stage as string;
		if (stageExt && STAGE_TAG_MAP[stageExt.toLowerCase()]) {
			return STAGE_TAG_MAP[stageExt.toLowerCase()];
		}

		for (const tag of tags) {
			const lower = tag.toLowerCase();
			if (STAGE_TAG_MAP[lower]) return STAGE_TAG_MAP[lower];
		}

		return "friend";
	}

	private static determineRelationship(stage: CharacterStage): string {
		const map: Record<CharacterStage, string> = {
			stranger: "Stranger",
			acquaintance: "Acquaintance",
			friend: "Friend",
			close: "Close friend",
			partner: "Romantic partner",
			intimate: "Soulmate",
		};
		return map[stage];
	}

	private static extractAge(description: string): number | undefined {
		const match = description.match(/(\d{2})\s*(?:years?\s*(?:old)?)?/i);
		return match ? parseInt(match[1]) : undefined;
	}

	private static extractOccupation(_description: string): string | undefined {
		return undefined;
	}

	private static extractBase64Image(arrayBuf: ArrayBuffer): string {
		const base64 = btoa(
			new Uint8Array(arrayBuf).reduce((data, byte) => data + String.fromCharCode(byte), ""),
		);
		return `data:image/png;base64,${base64}`;
	}
}
