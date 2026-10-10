import { useCallback, useEffect, useRef, useState } from "react";
import type { CharacterCard } from "@/types/character";

const GUEST_ENDPOINT = "https://api.privseai.com/v1/prompt/analyze";
const GUEST_LIMIT = 3;
const GUEST_SEEN_KEY = "privsei.guestTrialSeen";

export interface GuestMessage {
	role: "user" | "assistant";
	content: string;
}

interface GuestChatResponse {
	reply?: string;
	remaining?: number;
	error?: string;
}

function buildPersonaContext(card: CharacterCard): string {
	const d = card.data;
	return [
		`You are ${d.name}. ${d.personality}`,
		d.scenario ? `Scenario: ${d.scenario}` : "",
		"Stay fully in character. Keep replies under 120 words.",
	].filter(Boolean).join("\n");
}

/**
 * Guest trial chat — 3 free messages, no signup (OpenPerso Phase 3).
 * Backed by the keyless freellmpool pool via the PrivseAI proxy.
 */
export function useGuestChat(card: CharacterCard | null) {
	const [messages, setMessages] = useState<GuestMessage[]>([]);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [remaining, setRemaining] = useState<number | null>(GUEST_LIMIT);
	const [limitReached, setLimitReached] = useState(false);
	const controllerRef = useRef<AbortController | null>(null);

	// Reset when the card changes
	useEffect(() => {
		setMessages([]);
		setRemaining(GUEST_LIMIT);
		setLimitReached(false);
		setError("");
	}, [card?.data.name]);

	const send = useCallback(
		async (text: string) => {
			if (!card || busy || limitReached || !text.trim()) return;
			setError("");
			setBusy(true);
			const abort = new AbortController();
			controllerRef.current = abort;
			try {
				const history: GuestMessage[] = [
					...messages,
					{ role: "user", content: text.trim() },
				];
				const doFetch = async (withSignal: boolean) =>
					fetch(GUEST_ENDPOINT, {
						method: "POST",
						...(withSignal ? { signal: abort.signal } : {}),
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							task: "guest-chat",
							messages: [
								{ role: "system", content: buildPersonaContext(card) },
								...history.slice(-4),
							],
						}),
					});
				let res: Response;
				try {
					res = await doFetch(true);
				} catch (sigErr) {
					if (sigErr instanceof TypeError && /AbortSignal/.test(sigErr.message)) {
						res = await doFetch(false);
					} else {
						throw sigErr;
					}
				}
				const data = (await res.json()) as GuestChatResponse;
				if (res.status === 429) {
					setLimitReached(true);
					setRemaining(0);
					setError(data.error ?? "Guest trial ended.");
					return;
				}
				if (!res.ok || !data.reply) {
					throw new Error(data.error ?? `Trial chat failed (HTTP ${res.status}).`);
				}
				setMessages([...history, { role: "assistant", content: data.reply }]);
				if (typeof data.remaining === "number") {
					setRemaining(data.remaining);
					if (data.remaining <= 0) setLimitReached(true);
				}
			} catch (e) {
				if (!abort.signal.aborted) {
					setError(e instanceof Error ? e.message : "Trial chat failed.");
				}
			} finally {
				setBusy(false);
				controllerRef.current = null;
			}
		},
		[card, busy, limitReached, messages],
	);

	const cancel = useCallback(() => controllerRef.current?.abort(), []);

	return {
		messages,
		send,
		cancel,
		busy,
		error,
		remaining,
		limitReached,
		canChat: !!card && !limitReached,
	};
}

/** Marks that the guest has used the trial (for badge/CTA logic). */
export function markGuestTrialSeen(): void {
	try {
		localStorage.setItem(GUEST_SEEN_KEY, String(Date.now()));
	} catch {
		/* ignore */
	}
}

export function hasUsedGuestTrial(): boolean {
	try {
		return !!localStorage.getItem(GUEST_SEEN_KEY);
	} catch {
		return false;
	}
}
