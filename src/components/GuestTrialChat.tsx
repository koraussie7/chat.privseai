import { useState } from "react";
import type { CharacterCard } from "@/types/character";
import { useGuestChat, markGuestTrialSeen } from "@/lib/guest-chat";

/**
 * Guest trial chat panel — 3 free messages, no signup (OpenPerso Phase 3).
 * Renders inline on Discover when a card is previewed by a non-signed-in user.
 */
export function GuestTrialChat({ card }: { card: CharacterCard }) {
	const { messages, send, cancel, busy, error, remaining, limitReached, canChat } =
		useGuestChat(card);
	const [draft, setDraft] = useState("");
	const [started, setStarted] = useState(false);

	const start = () => {
		setStarted(true);
		markGuestTrialSeen();
	};

	if (!started) {
		return (
			<div className="rounded-3xl border border-white/10 bg-[#0e1017] p-5 mb-6">
				<h3 className="text-lg font-bold text-white">💬 Try {card.data.name} free</h3>
				<p className="mt-1 text-xs text-gray-400">
					3 messages, no account needed. Powered by our free model pool.
				</p>
				<button
					type="button"
					onClick={start}
					className="mt-3 rounded-xl bg-pink-600 px-4 py-2 text-sm font-semibold text-white"
				>
					Start trial chat
				</button>
			</div>
		);
	}

	return (
		<div className="rounded-3xl border border-white/10 bg-[#0e1017] p-5 mb-6">
			<div className="flex items-center justify-between mb-3">
				<h3 className="text-sm font-bold text-white">Trial chat with {card.data.name}</h3>
				<span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-gray-300">
					{remaining === null ? GUEST_LEFT : `${Math.max(remaining ?? 0, 0)} messages left`}
				</span>
			</div>

			<div className="max-h-64 overflow-y-auto space-y-2 mb-3 pr-1">
				{messages.length === 0 && (
					<p className="text-xs text-gray-500">Say hello to start the trial.</p>
				)}
				{messages.map((m, i) => (
					<div
						key={i}
						className={`text-xs rounded-xl px-3 py-2 max-w-[85%] ${
							m.role === "user"
								? "ml-auto bg-pink-600/80 text-white"
								: "bg-white/5 text-gray-200"
						}`}
					>
						{m.content}
					</div>
				))}
			</div>

			{error && (
				<p role="alert" className="text-xs text-red-300 mb-2">
					{error}
				</p>
			)}

			{limitReached ? (
				<div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
					<p className="text-xs text-amber-200 font-semibold mb-1">
						Trial ended — you used all 3 messages
					</p>
					<p className="text-[10px] text-amber-100/80">
						Create an account to keep chatting with {card.data.name}, unlock images, and
						save your conversation memory.
					</p>
				</div>
			) : (
				<div className="flex gap-2">
					<input
						type="text"
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !busy && draft.trim()) {
								send(draft);
								setDraft("");
							}
						}}
						placeholder="Type a message…"
						maxLength={500}
						className="flex-1 rounded-xl bg-[#13141f] border border-white/10 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-pink-500/50"
					/>
					{busy ? (
						<button
							type="button"
							onClick={cancel}
							className="rounded-xl bg-white/10 px-3 py-2 text-xs text-white"
						>
							Stop
						</button>
					) : (
						<button
							type="button"
							onClick={() => {
								if (draft.trim()) {
									send(draft);
									setDraft("");
								}
							}}
							disabled={!canChat || !draft.trim()}
							className="rounded-xl bg-pink-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
						>
							Send
						</button>
					)}
				</div>
			)}
		</div>
	);
}

const GUEST_LEFT = "3 messages left";
