import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CompanionChat, type CompanionProfile } from "@/components/CompanionChat";
import { api } from "@/lib/config";
import { useAuth } from "@/hooks/useAuth";
import { useTrystero } from "@/hooks/useTrysteroP2P";
import { StatusPill } from "@/components/StatusPill";

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
		stage: "close",
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
		stage: "friend",
	},
];

export function ChatPage() {
	const [companions] = useState<CompanionProfile[]>(BUILTIN);
	const [activeId] = useState("luna");
	const { user, quota, isAuthenticated } = useAuth();
	const { colibriPeers } = useTrystero();
	const navigate = useNavigate();

	const companion = companions.find((c) => c.id === activeId) ?? companions[0];

	const onSend = useMemo(
		() => async (text: string) => {
			const byok = localStorage.getItem("byok_key")?.trim();
			const system = [
				`You are ${companion.name}.`,
				companion.bio,
				companion.personality?.length ? `Personality: ${companion.personality.join(", ")}` : "",
			]
				.filter(Boolean)
				.join("\n");

			const nearestColibri = colibriPeers.find((p) => !p.baseUrl.includes("localhost"));
			const colibri = nearestColibri
				? { baseUrl: nearestColibri.baseUrl, model: nearestColibri.model }
				: undefined;

			const res = await fetch(api("/chat"), {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					companionId: companion.id,
					message: text,
					system,
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
		[companion, colibriPeers],
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
						<StatusPill
							label={`${colibriPeers.length} Colibri P2P peers`}
							tone="good"
						/>
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
				companions={companions}
				onSelectCompanion={(id) => navigate(`/chat/${id}`)}
				onSend={onSend}
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
