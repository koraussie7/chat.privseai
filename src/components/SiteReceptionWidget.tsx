/**
 * SiteReceptionWidget — bottom-right floating bubble that opens a chat panel
 * powered by the server-side bitterbot reception agent (Luna).
 *
 * Endpoint: `/agent-chat/v1/chat/completions` (Caddy reverse-proxies to the
 * bitterbot gateway on the local server). Same-origin, so no CORS issues.
 *
 * Visitor-only mode (no auth): sessions are ephemeral, identified by a
 * random `x-openclaw-session-key` per tab. Companion-mode enforced server
 * side (Luna is chat-only).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface ReceptionMessage {
	role: "user" | "assistant";
	content: string;
}

const ENDPOINT = "/agent-chat/v1/chat/completions";
const AGENT_ID = "privseai-reception";
// Public, rate-limited visitor key — server-side enforces tool refusal.
const RECEPTION_BEARER = "9324631190ecf1ac8ef0240b0dc929c3672f8f68eacf75a4a31127d25e7df2e2";
const GREETING = "안녕하세요! Luna예요 🌙 privseai에서 무엇을 도와드릴까요?";

function makeSessionKey(): string {
	return `web-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

export function SiteReceptionWidget() {
	const [open, setOpen] = useState(false);
	const [messages, setMessages] = useState<ReceptionMessage[]>([]);
	const [input, setInput] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const sessionKey = useMemo(makeSessionKey, []);
	const scrollerRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (open && messages.length === 0) {
			setMessages([{ role: "assistant", content: GREETING }]);
		}
	}, [open, messages.length]);

	useEffect(() => {
		scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
	}, [messages.length, busy]);

	const send = useCallback(async () => {
		const text = input.trim();
		if (!text || busy) return;
		setInput("");
		setError(null);
		setMessages((prev) => [...prev, { role: "user", content: text }]);
		setBusy(true);
		try {
			const res = await fetch(ENDPOINT, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${RECEPTION_BEARER}`,
					"x-openclaw-session-key": `agent:${AGENT_ID}:openai-user:${sessionKey}`,
					"x-openclaw-agent-id": AGENT_ID,
				},
				body: JSON.stringify({
					model: "openclaw",
					messages: [
						...messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
						{ role: "user", content: text },
					],
					max_tokens: 220,
					user: `site-visitor:${sessionKey}`,
				}),
			});
			if (!res.ok) {
				const t = await res.text().catch(() => "");
				throw new Error(`${res.status}: ${t.slice(0, 120)}`);
			}
			const data = await res.json();
			const reply = data?.choices?.[0]?.message?.content ?? "";
			setMessages((prev) => [...prev, { role: "assistant", content: reply || "(응답 없음)" }]);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			setMessages((prev) => [
				...prev,
				{ role: "assistant", content: "잠시 후 다시 시도해주세요 🙏" },
			]);
		} finally {
			setBusy(false);
		}
	}, [input, busy, messages, sessionKey]);

	if (!open) {
		return (
			<button
				type="button"
				aria-label="Luna와 대화"
				onClick={() => setOpen(true)}
				className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-5 py-3 text-sm font-bold text-white shadow-2xl ring-1 ring-white/20 hover:scale-105 transition"
			>
				<span className="text-lg">🌙</span>
				<span>Luna에게 물어보기</span>
			</button>
		);
	}

	return (
		<div className="fixed bottom-5 right-5 z-50 flex h-[520px] w-[360px] flex-col rounded-2xl border border-white/10 bg-[#0a0c14]/95 shadow-2xl backdrop-blur">
			<header className="flex items-center justify-between rounded-t-2xl border-b border-white/5 bg-gradient-to-r from-fuchsia-500/20 to-indigo-500/20 px-4 py-3">
				<div className="flex items-center gap-2">
					<span className="text-lg">🌙</span>
					<div>
						<p className="text-sm font-bold text-white">Luna</p>
						<p className="text-[10px] uppercase tracking-wide text-fuchsia-200/70">privseai 안내</p>
					</div>
				</div>
				<button
					type="button"
					onClick={() => setOpen(false)}
					aria-label="닫기"
					className="rounded-full p-1 text-white/60 hover:bg-white/10 hover:text-white"
				>
					✕
				</button>
			</header>

			<div ref={scrollerRef} className="flex-1 overflow-y-auto px-4 py-3 text-sm text-white/85 space-y-2">
				{messages.map((m, i) => (
					<div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
						<div
							className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 ${
								m.role === "user" ? "bg-fuchsia-500/20 text-white" : "bg-white/5 text-white/90"
							}`}
						>
							{m.content}
						</div>
					</div>
				))}
				{busy ? (
					<div className="flex justify-start">
						<div className="rounded-2xl bg-white/5 px-3 py-2 text-white/60">
							<span className="animate-pulse">●</span> 입력 중...
						</div>
					</div>
				) : null}
			</div>

			{error ? <p className="px-4 text-xs text-amber-300/80">⚠ {error}</p> : null}

			<form
				className="flex gap-2 border-t border-white/5 p-3"
				onSubmit={(e) => {
					e.preventDefault();
					void send();
				}}
			>
				<input
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder="메시지를 입력하세요..."
					className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-fuchsia-400/50"
					disabled={busy}
				/>
				<button
					type="submit"
					disabled={busy || !input.trim()}
					className="rounded-xl bg-fuchsia-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
				>
					전송
				</button>
			</form>
		</div>
	);
}
