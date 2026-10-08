/**
 * YuriOS Bridge for privseai.com
 *
 * Integrates YuriOS companion system with privseai-trystero:
 * - YuriOS card format → privseai CompanionProfile
 * - Tool allowlist sync (MIND_TOOL_ALLOWLIST ↔ MCPRouter)
 * - Budget governor (token spend control)
 * - Inner life loop integration (AgentRouter intent)
 * - Vault/memory sync
 */

import { CharacterCardParser } from "@/lib/character-card";
import type { CharacterCard, CharacterCardData, CharacterStage } from "@/types/character";
import type { CompanionProfile } from "@/components/CompanionChat";
import type { NetworkState } from "@/lib/trystero-client";

export interface YuriOSCardData {
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

export interface YuriOSConfig {
	mindToolsEnabled: boolean;
	mindToolAllowlist: string[];
	mindDailyTokens: number;
	mindToolCallsPerDay: number;
	mindToolPressureCeiling: number;
	researchMaxCalls: number;
	searchBackend: boolean;
	vaultPath?: string;
	telegramBotToken?: string;
	telegramChatId?: string;
	vrmModelPath?: string;
	whisperModel?: string;
	kokoroVoice?: string;
}

export interface YuriOSCompanion {
	id: string;
	name: string;
	card: CharacterCard;
	profile: CompanionProfile;
	config: YuriOSConfig;
	vaultPath: string;
	activityState: "ENGAGED" | "IDLE" | "DORMANT" | "DREAM";
	mindLoopRunning: boolean;
	lastTick: number;
}

export interface ToolAuditEntry {
	callId: string;
	timestamp: number;
	tool: string;
	args: Record<string, unknown>;
	result: unknown;
	tokenCost: number;
	correlationId?: string;
}

const STAGE_MAP: Record<string, CharacterStage> = {
	stranger: "stranger",
	acquaintance: "acquaintance",
	friend: "friend",
	close: "close",
	partner: "partner",
	intimate: "intimate",
	romantic: "partner",
	dating: "close",
	soulmate: "intimate",
};

export class YuriOSBridge {
	private companions = new Map<string, YuriOSCompanion>();
	private toolAudit: ToolAuditEntry[] = [];
	private tokenSpentToday = 0;

	parseYuriOSCard(jsonContent: string, _fileName = "yurios-character.png"): CharacterCard {
		const parsed = JSON.parse(jsonContent);

		if (parsed.spec && ["chara_card_v2", "chara_card_v3"].includes(parsed.spec)) {
			return {
				spec: parsed.spec,
				data: CharacterCardParser["normalizeData"](parsed.data || parsed.data),
			};
		}

		const data: CharacterCardData = {
			name: parsed.name || parsed.cardName || "Unnamed",
			description: parsed.description || parsed.bio || parsed.scenario || "",
			personality: Array.isArray(parsed.personality)
				? parsed.personality.join("\n")
				: (parsed.personality?.traits?.join("\n") ?? parsed.personality ?? ""),
			scenario: parsed.scenario || parsed.background || "",
			first_mes: parsed.first_mes || parsed.greeting || "",
			mes_example: parsed.mes_example || "",
			creator_notes: parsed.creator_notes || parsed.notes || "",
			system_prompt: parsed.system_prompt || parsed.prompt || "",
			post_scriptment: parsed.post_scriptment || "",
			tags: parsed.tags || [],
			creator: parsed.creator || "YuriOS",
			character_version: parsed.version || "1.0",
			src: parsed.src || parsed.avatar?.url || parsed.image || "",
			extensions: {
				...(parsed.extensions || {}),
				vrm: parsed.vrm || parsed.vrmModel || parsed.extensions?.vrm,
				stage: parsed.extensions?.stage || parsed.stage,
				stability: parsed.extensions?.stability,
			},
		};

		return {
			spec: "chara_card_v2",
			data,
		};
	}

	importYuriOSCompanion(card: CharacterCard): CompanionProfile {
		const profile = CharacterCardParser.cardToProfile(card);

		if (card.data.extensions?.vrm) {
			profile.avatarUrl = card.data.extensions.vrm as string;
		}

		if (card.data.extensions?.stage && typeof card.data.extensions.stage === "string") {
			const stage = STAGE_MAP[card.data.extensions.stage as string];
			if (stage) {
				profile.stage = ["stranger", "acquaintance", "friend", "close", "partner", "intimate"].indexOf(stage);
			}
		}

		return profile;
	}

	createYuriOSConfig(env: Record<string, string>): YuriOSConfig {
		return {
			mindToolsEnabled: env.MIND_TOOLS_ENABLED === "true",
			mindToolAllowlist: (env.MIND_TOOL_ALLOWLIST || "write_note,append_note,read_note,list_notes")
				.split(",")
				.map((s) => s.trim()),
			mindDailyTokens: parseInt(env.MIND_DAILY_TOKENS || "5000"),
			mindToolCallsPerDay: parseInt(env.MIND_TOOL_CALLS_PER_DAY || "8"),
			mindToolPressureCeiling: parseFloat(env.MIND_TOOL_PRESSURE_CEILING || "0.5"),
			researchMaxCalls: parseInt(env.RESEARCH_MAX_CALLS || "100"),
			searchBackend: env.SEARCH_BACKEND !== "off",
			vaultPath: env.VAULT_PATH,
			telegramBotToken: env.TELEGRAM_BOT_TOKEN,
			telegramChatId: env.TELEGRAM_CHAT_ID,
			vrmModelPath: env.VRM_MODEL_PATH,
			whisperModel: env.WHISPER_MODEL || "base.en",
			kokoroVoice: env.KOKORO_VOICE || "en_US-am_pinyon-high",
		};
	}

	calculateTokenCost(prompt: string, output: string): number {
		const promptTokens = Math.ceil(prompt.length / 4);
		const outputTokens = Math.ceil(output.length / 4);
		return promptTokens + outputTokens;
	}

	checkBudget(config: YuriOSConfig, isToolCall = false): { allowed: boolean; reason?: string } {
		if (isToolCall) {
			if (!config.mindToolsEnabled) {
				return { allowed: false, reason: "MIND_TOOLS_ENABLED is false" };
			}
			if (this.tokenSpentToday >= config.mindDailyTokens && this.tokenSpentToday > 0) {
				return { allowed: false, reason: "Daily token budget exceeded" };
			}
		}
		return { allowed: true };
	}

	logToolCall(entry: Omit<ToolAuditEntry, "callId">): void {
		this.toolAudit.push({
			...entry,
			callId: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
		});
		this.tokenSpentToday += entry.tokenCost;
	}

	getToolAudit(): ToolAuditEntry[] {
		return [...this.toolAudit];
	}

	getTokenUsage(): number {
		return this.tokenSpentToday;
	}

	resetDailyBudget(): void {
		this.tokenSpentToday = 0;
	}

	registerCompanion(companion: YuriOSCompanion): void {
		this.companions.set(companion.id, companion);
	}

	getCompanion(id: string): YuriOSCompanion | undefined {
		return this.companions.get(id);
	}

	getAllCompanions(): YuriOSCompanion[] {
		return Array.from(this.companions.values());
	}

	mapActivityState(state: string): "ENGAGED" | "IDLE" | "DORMANT" | "DREAM" {
		switch (state.toUpperCase()) {
			case "ENGAGED":
				return "ENGAGED";
			case "IDLE":
				return "IDLE";
			case "DORMANT":
				return "DORMANT";
			case "DREAM":
			case "DREAMING":
				return "DREAM";
			default:
				return "IDLE";
		}
	}

	mapTrysteroToYuriOS(peers: NetworkState["peers"]): unknown[] {
		return peers.map((peer) => ({
			peerId: peer.id,
			type: peer.capabilities?.includes("fellowship") ? "fellowship" : "trystero_peer",
			latency: 0,
			connectedAt: peer.joinedAt,
		}));
	}
}
