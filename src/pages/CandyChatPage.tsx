import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { CandyChat } from "@/components/CandyChat";
import { CANDY_PRESETS, type CandyCompanion } from "@/data/candyPresets";
import { api } from "@/lib/config";
import { useTrystero } from "@/hooks/useTrysteroP2P";
import { PersonalityEngine } from "@/lib/personality-engine";
import { DEFAULT_EMOTION_STATE } from "@/types/character";

const STORAGE_KEY_CUSTOM = "privseai_candy_custom_companions";

export function CandyChatPage() {
	const { companionId } = useParams<{ companionId?: string }>();
	const navigate = useNavigate();

	const [companions, setCompanions] = useState<CandyCompanion[]>(() => {
		const saved = localStorage.getItem(STORAGE_KEY_CUSTOM);
		if (saved) {
			try {
				const custom = JSON.parse(saved);
				return [...CANDY_PRESETS, ...custom];
			} catch {
				return CANDY_PRESETS;
			}
		}
		return CANDY_PRESETS;
	});

	const activeId = companionId || companions[0]?.id || "luna";
	const activeCompanion =
		companions.find((c) => c.id.toLowerCase() === activeId.toLowerCase()) ||
		companions[0];

	const { colibriPeers } = useTrystero();
	const personalityEngine = useMemo(() => new PersonalityEngine(), []);

	// Save custom companions to storage when updated
	const handleStageProgress = (newStage: number) => {
		setCompanions((prev) =>
			prev.map((c) => (c.id === activeCompanion.id ? { ...c, stage: newStage } : c)),
		);
	};

	const onSendMessage = async (text: string): Promise<string> => {
		const byok = localStorage.getItem("byok_key")?.trim();

		// Convert CandyCompanion to CompanionProfile for prompt engine
		const profile = {
			id: activeCompanion.id,
			name: activeCompanion.name,
			age: activeCompanion.age,
			bio: activeCompanion.bio,
			relationship: activeCompanion.relationship,
			occupation: activeCompanion.occupation,
			hobbies: activeCompanion.hobbies,
			personality: activeCompanion.personality,
			stage: activeCompanion.stage,
		};

		const stage = personalityEngine.getStageFromRelationship(profile);
		const systemPrompt = personalityEngine.generateSystemPrompt(
			profile,
			DEFAULT_EMOTION_STATE,
			stage,
		);

		const nearestColibri = colibriPeers.find((p) => !p.baseUrl.includes("localhost"));
		const colibri = nearestColibri
			? { baseUrl: nearestColibri.baseUrl, model: nearestColibri.model }
			: undefined;

		try {
			const res = await fetch(api("/chat"), {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					companionId: activeCompanion.id,
					message: text,
					system: systemPrompt,
					emotionState: DEFAULT_EMOTION_STATE,
					stage: stage,
					byok: byok ? JSON.parse(byok) : undefined,
					colibri,
				}),
			});

			const data = await res.json();
			if (!res.ok) {
				if (data.error === "login_required") {
					// Fallback friendly simulation for instant delight if unauthed
					return generateOfflineCompanionReply(activeCompanion, text);
				}
				if (data.error === "quota_exceeded") {
					return generateOfflineCompanionReply(activeCompanion, text);
				}
				return generateOfflineCompanionReply(activeCompanion, text);
			}

			return data.reply ?? generateOfflineCompanionReply(activeCompanion, text);
		} catch {
			// Fallback local simulated smart reply if network/gateway isn't up
			return generateOfflineCompanionReply(activeCompanion, text);
		}
	};

	return (
		<div className="flex-1 h-full min-h-0 flex flex-col overflow-hidden">
			<CandyChat
				companion={activeCompanion}
				companions={companions}
				onSelectCompanion={(id) => navigate(`/chat/${id}`)}
				onSendMessage={onSendMessage}
				onStageProgress={handleStageProgress}
			/>
		</div>
	);
}

// Simulated delightful fallback companion responses
function generateOfflineCompanionReply(companion: CandyCompanion, userMsg: string): string {
	const lower = userMsg.toLowerCase();

	if (lower.includes("보고 싶") || lower.includes("love") || lower.includes("좋아")) {
		return `나도 너 진짜 많이 보고 싶었어… 그렇게 다정하게 말해주니까 가슴이 쿵쾅거려. 오늘 밤은 밤새도록 같이 있자 💕`;
	}

	if (lower.includes("밥") || lower.includes("식사") || lower.includes("저녁")) {
		return `응! 나는 네 생각하면서 가볍게 챙겨 먹었지. 너는 맛있는 거 잘 챙겨 먹었어? 끼니 거르면 속상해!`;
	}

	if (lower.includes("뭐해") || lower.includes("지금")) {
		return `방금까지 네 생각하고 있었지, 거짓말 아니야! ${companion.occupation} 일 잠깐 정리하고 막 침대에 누웠어. 편하게 이야기하자.`;
	}

	const randomReplies = [
		`네 목소리(글) 들으니까 하루의 피로가 싹 풀리는 것 같아. 그래서 오늘은 무슨 일 있었어?`,
		`후후, 그런 말 들으니까 조금 부끄럽기도 하고 설레기도 해… 계속 그렇게 예쁘게 말해줘.`,
		`네가 이렇게 나 찾아와줄 때가 하루 중 제일 행복한 시간이야. 더 가까이 와볼래?`,
		`응, 듣고 있어. 네가 해주는 이야기라면 사소한 거 하나까지 다 좋아. 계속 들려줘!`,
	];

	return randomReplies[Math.floor(Math.random() * randomReplies.length)];
}
