/**
 * Candy AI-inspired Chat UI
 * Layout: left chat list | center thread | right profile panel
 * Adapted for privseai-trystero Tailwind stack.
 */
import { useEffect, useRef, useState } from "react";

export interface UIMessage {
	id: string;
	role: "user" | "assistant";
	content: string;
	timestamp: string;
}

export interface CompanionProfile {
	id: string;
	name: string;
	age?: number;
	avatarUrl?: string;
	gallery?: string[];
	bio?: string;
	relationship?: string;
	occupation?: string;
	hobbies?: string[];
	personality?: string[];
	stage?: string;
}

interface Props {
	companion: CompanionProfile;
	companions?: CompanionProfile[];
	onSelectCompanion?: (id: string) => void;
	onSend: (text: string) => Promise<string>;
	initialMessages?: UIMessage[];
}

const PLACEHOLDER_AVATAR =
	"data:image/svg+xml," +
	encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" fill="none">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#a78bfa"/><stop offset="1" stop-color="#ec4899"/>
      </linearGradient></defs>
      <rect width="400" height="500" fill="url(#g)"/>
      <circle cx="200" cy="180" r="70" fill="#fafafa" opacity=".9"/>
      <ellipse cx="200" cy="380" rx="110" ry="90" fill="#fafafa" opacity=".9"/>
    </svg>`,
	);

export function CompanionChat({
	companion,
	companions = [],
	onSelectCompanion,
	onSend,
	initialMessages = [],
}: Props) {
	const [messages, setMessages] = useState<UIMessage[]>(initialMessages);
	const [input, setInput] = useState("");
	const [loading, setLoading] = useState(false);
	const [profileOpen, setProfileOpen] = useState(true);
	const bottomRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	async function handleSend() {
		const text = input.trim();
		if (!text || loading) return;
		const userMsg: UIMessage = {
			id: crypto.randomUUID(),
			role: "user",
			content: text,
			timestamp: new Date().toISOString(),
		};
		setMessages((m) => [...m, userMsg]);
		setInput("");
		setLoading(true);
		try {
			const reply = await onSend(text);
			setMessages((m) => [
				...m,
				{
					id: crypto.randomUUID(),
					role: "assistant",
					content: reply,
					timestamp: new Date().toISOString(),
				},
			]);
		} catch {
			setMessages((m) => [
				...m,
				{
					id: crypto.randomUUID(),
					role: "assistant",
					content: "잠깐 연결이 불안정해요. 다시 보내 줄래요?",
					timestamp: new Date().toISOString(),
				},
			]);
		} finally {
			setLoading(false);
		}
	}

	const avatar = companion.avatarUrl || PLACEHOLDER_AVATAR;
	const list = companions.length ? companions : [companion];

	return (
		<div className="flex h-full min-h-0 w-full bg-[#070b13] text-gray-100 overflow-hidden rounded-xl border border-white/10">
			<aside className="hidden md:flex w-56 lg:w-64 shrink-0 flex-col border-r border-white/10 bg-[#0a101b]">
				<div className="p-3 border-b border-white/10">
					<input
						type="search"
						placeholder="Search chats…"
						className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-gray-300 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-cyan-400/50"
					/>
				</div>
				<div className="flex-1 overflow-y-auto">
					{list.map((c) => {
						const active = c.id === companion.id;
						return (
							<button
								type="button"
								key={c.id}
								onClick={() => onSelectCompanion?.(c.id)}
								className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition ${
									active
										? "bg-cyan-500/10 border-l-2 border-cyan-400"
										: "hover:bg-white/5 border-l-2 border-transparent"
								}`}
							>
								<img
									src={c.avatarUrl || PLACEHOLDER_AVATAR}
									alt=""
									className="w-10 h-10 rounded-full object-cover ring-1 ring-white/10"
								/>
								<div className="min-w-0 flex-1">
									<div className="text-sm font-medium truncate">{c.name}</div>
									<div className="text-[11px] text-gray-500 truncate">
										{c.personality?.[0] ?? c.stage ?? "Companion"}
									</div>
								</div>
							</button>
						);
					})}
				</div>
			</aside>

			<section className="flex-1 min-w-0 flex flex-col bg-gradient-to-b from-[#070b13] via-[#070b13] to-[#0a101b]/80">
				<div className="flex items-center gap-3 px-3 md:px-4 py-2.5 border-b border-white/10 shrink-0 bg-[#070b13]/80 backdrop-blur">
					<img
						src={avatar}
						alt=""
						className="w-9 h-9 rounded-full object-cover ring-2 ring-cyan-400/30 cursor-pointer"
						onClick={() => setProfileOpen((v) => !v)}
					/>
					<div className="min-w-0 flex-1">
						<div className="font-semibold text-sm truncate">{companion.name}</div>
						<div className="text-[11px] text-emerald-300/90 flex items-center gap-1">
							<span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
							Online
						</div>
					</div>
					<div className="flex items-center gap-1 text-gray-400">
						<button
							type="button"
							title="Profile"
							onClick={() => setProfileOpen((v) => !v)}
							className="w-9 h-9 rounded-full hover:bg-white/5 flex items-center justify-center text-sm"
						>
							☰
						</button>
					</div>
				</div>

				<div className="flex-1 overflow-y-auto px-3 md:px-5 py-4 space-y-3">
					{messages.map((m) => (
						<div
							key={m.id}
							className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} gap-2`}
						>
							{m.role === "assistant" && (
								<img
									src={avatar}
									alt=""
									className="w-7 h-7 rounded-full object-cover shrink-0 mt-1 hidden sm:block"
								/>
							)}
							<div
								className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
									m.role === "user"
										? "bg-gradient-to-br from-cyan-600 to-blue-600 text-white rounded-br-md"
										: "bg-white/5 text-gray-100 rounded-bl-md border border-white/10"
								}`}
							>
								{m.content}
							</div>
						</div>
					))}
					{loading && (
						<div className="flex items-center gap-2 text-xs text-gray-500 pl-1">
							<span className="inline-flex gap-1">
								<span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" />
								<span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.15s]" />
								<span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.3s]" />
							</span>
							{companion.name} is typing…
						</div>
					)}
					<div ref={bottomRef} />
				</div>

				<div className="shrink-0 border-t border-white/10 bg-[#070b13]/90 p-3 md:p-4">
					<div className="flex gap-2 mb-2">
						<QuickChip label="✨ Selfie" />
						<QuickChip label="🎙️ Voice" />
						<QuickChip label="💫 Scene" />
					</div>
					<div className="flex items-end gap-2">
						<textarea
							rows={1}
							className="flex-1 resize-none rounded-2xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/40 placeholder:text-gray-600 max-h-32"
							placeholder={`Message ${companion.name}…`}
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && !e.shiftKey) {
									e.preventDefault();
									handleSend();
								}
							}}
							disabled={loading}
						/>
						<button
							type="button"
							onClick={handleSend}
							disabled={loading || !input.trim()}
							className="shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-40 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20"
							aria-label="Send"
						>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
								<path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
							</svg>
						</button>
					</div>
				</div>
			</section>

			{profileOpen && (
				<aside className="hidden lg:flex w-72 xl:w-80 shrink-0 flex-col border-l border-white/10 bg-[#0a101b] overflow-y-auto">
					<div className="relative">
						<img src={avatar} alt={companion.name} className="w-full aspect-[4/5] object-cover" />
						<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#070b13] via-[#070b13]/60 to-transparent pt-16 pb-3 px-4">
							<h2 className="text-xl font-semibold">
								{companion.name}
								{companion.age ? (
									<span className="text-gray-400 font-normal">, {companion.age}</span>
								) : null}
							</h2>
							{companion.stage && (
								<p className="text-xs text-cyan-400 mt-0.5 capitalize">{companion.stage}</p>
							)}
						</div>
					</div>
					<div className="p-4 space-y-4 text-sm">
						{companion.bio && <p className="text-gray-300 leading-relaxed">{companion.bio}</p>}
						<ProfileRow label="Relationship" value={companion.relationship} />
						<ProfileRow label="Occupation" value={companion.occupation} />
						{companion.hobbies?.length ? (
							<div>
								<div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1.5">Hobbies</div>
								<div className="flex flex-wrap gap-1.5">
									{companion.hobbies.map((h) => (
										<span
											key={h}
											className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-gray-300 border border-white/10"
										>
											{h}
										</span>
									))}
								</div>
							</div>
						) : null}
						{companion.personality?.length ? (
							<div>
								<div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1.5">
									Personality
								</div>
								<div className="flex flex-wrap gap-1.5">
									{companion.personality.map((p) => (
										<span
											key={p}
											className="text-xs px-2 py-0.5 rounded-full bg-cyan-400/10 text-cyan-300 border border-cyan-400/20"
										>
											{p}
										</span>
									))}
								</div>
							</div>
						) : null}
					</div>
				</aside>
			)}
		</div>
	);
}

function QuickChip({ label }: { label: string }) {
	return (
		<button
			type="button"
			className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-gray-200 hover:border-cyan-400/40 transition"
		>
			{label}
		</button>
	);
}

function ProfileRow({ label, value }: { label: string; value?: string }) {
	if (!value) return null;
	return (
		<div>
			<div className="text-[11px] uppercase tracking-wider text-gray-500 mb-0.5">{label}</div>
			<div className="text-gray-200">{value}</div>
		</div>
	);
}
