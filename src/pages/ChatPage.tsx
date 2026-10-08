import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CompanionChat, type CompanionProfile } from "@/components/CompanionChat";
import { CharacterCardUploader } from "@/components/CharacterCardUploader";
import { PersonalityEngine } from "@/lib/personality-engine";
import { CharacterCardParser } from "@/lib/character-card";
import { api } from "@/lib/config";
import { useAuth } from "@/hooks/useAuth";
import { useTrystero } from "@/hooks/useTrysteroP2P";
import { StatusPill } from "@/components/StatusPill";
import type { CharacterCard, EmotionState, ParsedCharacterCard } from "@/types/character";
import { DEFAULT_EMOTION_STATE } from "@/types/character";

const BUILTIN: CompanionProfile[] = [
	{
		id: "luna",
		name: "Luna",
		age: 24,
		bio: "밤하늘을 좋아하고, 조용한 대화를 즐기는 타입.",
		relationship: "Close friend",
		occupation: "Illustrator",
		hobbies: ["Stargazing", "Coffee"],
		personality: ["Warm", "Curious", "Gentle"],
		stage: 3,
	},
	{
		id: "aria",
		name: "Aria",
		age: 22,
		bio: "처음 만난 사이지만 금방 친해질 수 있어요.",
		relationship: "New companion",
		occupation: "Student",
		hobbies: ["Reading", "Walking"],
		personality: ["Playful", "Attentive"],
		stage: 2,
	},
];

const STORAGE_KEY = "privseai_companion_cards";

export function ChatPage() {
	const [companions] = useState<CompanionProfile[]>(BUILTIN);
	const [activeId, setActiveId] = useState("luna");
	const [importedCards, setImportedCards] = useState<CharacterCard[]>([]);
	const [emotionState, setEmotionState] = useState<Record<string, EmotionState>>({});
	const { user, quota, isAuthenticated } = useAuth();
	const { colibriPeers } = useTrystero();
	const navigate = useNavigate();
	const personalityEngine = useMemo(() => new PersonalityEngine(), []);

	useEffect(() => {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved) {
			try {
				setImportedCards(JSON.parse(saved));
			} catch {}
		}
	}, []);

	const allProfiles = useMemo(() => {
		const imported = importedCards.map((card) => CharacterCardParser.cardToProfile(card));
		return [...companions, ...imported];
	}, [companions, importedCards]);

	const companion = allProfiles.find((c) => c.id === activeId) ?? allProfiles[0];

	const handleImportCard = (parsed: ParsedCharacterCard) => {
		const newCards = [...importedCards, parsed.card];
		setImportedCards(newCards);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(newCards));

		const profile = CharacterCardParser.cardToProfile(parsed.card);
		setActiveId(profile.id);
	};

	const currentEmotion = emotionState[companion.id] ?? DEFAULT_EMOTION_STATE;
	const stage = personalityEngine.getStageFromRelationship(companion);

	const onSend = useMemo(
		() => async (text: string) => {
			const byok = localStorage.getItem("byok_key")?.trim();

			const systemPrompt = personalityEngine.generateSystemPrompt(
				companion,
				currentEmotion,
				stage,
			);

			const nearestColibri = colibriPeers.find((p) => !p.baseUrl.includes("localhost"));
			const colibri = nearestColibri
				? { baseUrl: nearestColibri.baseUrl, model: nearestColibri.model }
				: undefined;

			const emotion = personalityEngine.updateEmotion({ type: "message" }, currentEmotion);
			setEmotionState((prev) => ({ ...prev, [companion.id]: emotion }));

			const res = await fetch(api("/chat"), {
				method: "POST",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
					...(byok ? { Authorization: `Bearer ${byok}` } : {}),
				},
				body: JSON.stringify({
					companionId: companion.id,
					message: text,
					system: systemPrompt,
					emotionState: currentEmotion,
					stage: stage,
					byok: byok ? JSON.parse(byok) : undefined,
					colibri,
				}),
			});

			const data = await res.json();
			if (!res.ok) {
				if (data.error === "login_required") {
					return "무료 채팅은 로그인 후 이용할 수 있습니다. Settings에서 Google/GitHub로 로그인하거나 BYOK 키를 넣어 주세요.";
				}
				if (data.error === "quota_exceeded") {
					return data.message ?? "오늘 무료 횟수를 모두 사용했어요. BYOK를 연결하거나 내일 다시 와 주세요.";
				}
				throw new Error(data.message || data.error || `HTTP ${res.status}`);
			}
			const route = data.route?.mode ?? "unknown";
			return `${data.reply ?? "…"}\n\n[Via: ${route}${colibri ? " + Colibri P2P" : ""}]\n`;
		},
		[companion, currentEmotion, stage, colibriPeers, personalityEngine],
	);

	const quotaRemaining = quota?.remaining ?? 0;
	const quotaLimit = quota?.limit ?? 20;

	return (
		<div className="flex-1 min-h-0 flex flex-col h-[calc(100vh-4.25rem)]">
			<div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-[#0a101b]">
				<span className="text-sm font-medium">
					{isAuthenticated ? (
						<span className="flex items-center gap-2">
							<span className="w-2 h-2 rounded-full bg-emerald-400" />
							{user?.name ?? user?.email}
						</span>
					) : (
						<span className="flex items-center gap-2 text-gray-400">
							<span className="w-2 h-2 rounded-full bg-gray-500" />
							Not logged in
						</span>
					)}
				</span>
				<div className="flex items-center gap-2">
					{colibriPeers.length > 0 && (
						<StatusPill label={`${colibriPeers.length} Colibri P2P peers`} tone="good" />
					)}
					{isAuthenticated && (
						<StatusPill
							label={`${quotaRemaining}/${quotaLimit} free today`}
							tone={quotaRemaining > 5 ? "good" : quotaRemaining > 0 ? "warn" : "neutral"}
						/>
					)}
				</div>
			</div>
			<CompanionChat
				companion={companion}
				companions={allProfiles}
				onSelectCompanion={(id) => {
					setActiveId(id);
					navigate(`/chat/${id}`);
				}}
				onSend={onSend}
				profileSlot={<CharacterCardUploader onImport={handleImportCard} />}
				initialMessages={[
					{
						id: "welcome",
						role: "assistant",
						content: `안녕, 난 ${companion.name}. 오늘 하루는 어땠어?`,
						timestamp: new Date().toISOString(),
					},
				]}
			/>
		</div>
	);
}
