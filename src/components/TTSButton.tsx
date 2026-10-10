/**
 * TTSButton — synthesize a chat message into speech via a local
 * gpt-sovits-compatible server (see TTSBridge) and play it inline.
 *
 * Off by default: the user must have enabled TTS in settings AND acknowledged
 * they have rights to the voice, because voice cloning can impersonate people.
 */
import { useEffect, useRef, useState } from "react";
import {
	synthesizeSpeech,
	configForCompanion,
	DEFAULT_TTS_ENDPOINT,
	TTSBridgeError,
} from "@/lib/integration/TTSBridge";

interface Props {
	text: string;
	companionName: string;
	voiceAudioUrl?: string;
	/** endpoint from settings; falls back to the local default */
	endpoint?: string;
}

export function TTSButton({ text, companionName, voiceAudioUrl, endpoint }: Props) {
	const [state, setState] = useState<"idle" | "loading" | "playing" | "error">("idle");
	const [error, setError] = useState<string | null>(null);
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const urlRef = useRef<string | null>(null);

	// Clean up the object URL when the button unmounts.
	useEffect(() => {
		return () => {
			audioRef.current?.pause();
			if (urlRef.current) URL.revokeObjectURL(urlRef.current);
		};
	}, []);

	const handleClick = async () => {
		if (state === "playing") {
			audioRef.current?.pause();
			setState("idle");
			return;
		}
		setState("loading");
		setError(null);
		try {
			const consent = localStorage.getItem("privsei.tts.consent") === "true";
			const config = configForCompanion(
				{ name: companionName, voiceAudioUrl },
				endpoint || localStorage.getItem("privsei.tts.endpoint") || DEFAULT_TTS_ENDPOINT,
			);
			const result = await synthesizeSpeech(config, { text }, consent);
			if (urlRef.current) URL.revokeObjectURL(urlRef.current);
			urlRef.current = result.audioUrl;
			const audio = new Audio(result.audioUrl);
			audioRef.current = audio;
			audio.onended = () => setState("idle");
			await audio.play();
			setState("playing");
		} catch (err) {
			setState("error");
			setError(
				err instanceof TTSBridgeError
					? err.code === "consent-required"
						? "Enable TTS in Settings first"
						: err.message
					: err instanceof Error
						? err.message
						: "TTS failed",
			);
		}
	};

	return (
		<button
			type="button"
			onClick={handleClick}
			title={error ?? "Play as speech"}
			aria-label={`Play ${companionName}'s reply as speech`}
			className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition ${
				state === "error"
					? "border-rose-500/40 text-rose-300"
					: "border-white/10 text-gray-400 hover:text-gray-200 hover:border-white/20"
			}`}
		>
			{state === "loading" ? "…" : state === "playing" ? "⏸" : "🔊"}
			<span>{state === "error" ? "TTS off" : "Speak"}</span>
		</button>
	);
}
