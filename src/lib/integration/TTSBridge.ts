/**
 * TTSBridge — send chatbot text to a local gpt-sovits (or compatible) HTTP
 * server and get synthesized audio back, so PrivseAI companions can speak.
 *
 * my-neuro ships a gpt-sovits voice stack; we do NOT bundle it. This bridge
 * targets a user-run HTTP endpoint (default http://127.0.0.1:9880), the same
 * way the existing prompt-proxy talks to a local service.
 *
 * Privacy: text is only sent to the endpoint the user configured. Nothing is
 * forwarded to a third party. Reference audio (voice cloning) stays local.
 *
 * Safety: voice cloning can impersonate real people. `assertConsent` and the
 * `consentAcknowledged` flag force callers to record that the user has rights
 * to the reference voice before any synthesis happens.
 */

export interface TTSConfig {
	/** Base URL of the gpt-sovits-compatible server */
	endpoint: string;
	/** speaker / voice id, or "default" to use the server's default */
	speaker: string;
	/** optional text language hint: "ko" | "en" | "ja" | "zh" | "auto" */
	language?: string;
	/** reference audio path/URL for zero-shot cloning (server-side) */
	referenceAudio?: string;
	/** reference text matching referenceAudio, some servers require it */
	referenceText?: string;
	/** request timeout in ms */
	timeoutMs?: number;
}

export interface TTSRequest {
	text: string;
	speaker?: string;
	/** override language for this call */
	language?: string;
}

export interface TTSResult {
	/** object URL or data URL ready for an <audio> element */
	audioUrl: string;
	/** raw audio bytes (kept so callers can persist/cache them) */
	audio: Blob;
	mimeType: string;
	durationHintMs?: number;
}

export class TTSBridgeError extends Error {
	code:
		| "not-configured"
		| "consent-required"
		| "empty-text"
		| "network"
		| "provider-error"
		| "empty-audio";
	constructor(code: TTSBridgeError["code"], message: string) {
		super(message);
		this.name = "TTSBridgeError";
		this.code = code;
	}
}

export const DEFAULT_TTS_ENDPOINT = "http://127.0.0.1:9880";
const DEFAULT_TIMEOUT = 30_000;
const MAX_TEXT = 1200;

/** Validate a user-supplied endpoint; only http(s) local/remote hosts allowed. */
export function normalizeTTSEndpoint(raw: string): string {
	const trimmed = raw.trim().replace(/\/+$/, "");
	if (!/^https?:\/\//i.test(trimmed)) {
		throw new TTSBridgeError(
			"not-configured",
			"TTS endpoint must start with http:// or https://",
		);
	}
	return trimmed;
}

/**
 * Synthesize `request.text` into audio.
 *
 * @param consentAcknowledged caller confirms the user has rights to the voice.
 */
export async function synthesizeSpeech(
	config: TTSConfig,
	request: TTSRequest,
	consentAcknowledged: boolean,
	fetchImpl: typeof fetch = fetch,
): Promise<TTSResult> {
	if (!consentAcknowledged) {
		throw new TTSBridgeError(
			"consent-required",
			"Voice synthesis requires the user to confirm they have rights to the reference voice.",
		);
	}
	const text = (request.text ?? "").trim();
	if (!text) throw new TTSBridgeError("empty-text", "Cannot synthesize empty text.");
	const endpoint = normalizeTTSEndpoint(config.endpoint || DEFAULT_TTS_ENDPOINT);

	const controller = new AbortController();
	const timer = setTimeout(
		() => controller.abort(),
		config.timeoutMs ?? DEFAULT_TIMEOUT,
	);

	try {
		const response = await fetchImpl(`${endpoint}/api/tts`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			signal: controller.signal,
			body: JSON.stringify({
				text: text.slice(0, MAX_TEXT),
				speaker: request.speaker || config.speaker || "default",
				language: request.language || config.language || "auto",
				reference_audio: config.referenceAudio || undefined,
				reference_text: config.referenceText || undefined,
			}),
		});

		if (!response.ok) {
			throw new TTSBridgeError(
				"provider-error",
				`TTS server returned HTTP ${response.status}`,
			);
		}

		const audio = await response.blob();
		if (!audio.size) {
			throw new TTSBridgeError("empty-audio", "TTS server returned no audio.");
		}
		return {
			audioUrl: URL.createObjectURL(audio),
			audio,
			mimeType: audio.type || "audio/wav",
		};
	} catch (error) {
		if (error instanceof TTSBridgeError) throw error;
		if (error instanceof DOMException && error.name === "AbortError") {
			throw new TTSBridgeError("network", "TTS request timed out.");
		}
		throw new TTSBridgeError(
			"network",
			error instanceof Error ? error.message : "TTS request failed.",
		);
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Probe a TTS endpoint before enabling the feature, so the UI can show
 * "connected / not running" without synthesizing anything.
 */
export async function probeTTS(
	endpoint: string,
	fetchImpl: typeof fetch = fetch,
): Promise<{ online: boolean; detail: string }> {
	let base: string;
	try {
		base = normalizeTTSEndpoint(endpoint || DEFAULT_TTS_ENDPOINT);
	} catch (error) {
		return {
			online: false,
			detail: error instanceof Error ? error.message : "invalid endpoint",
		};
	}
	try {
		const response = await fetchImpl(`${base}/api/health`, {
			method: "GET",
			signal: AbortSignal.timeout(4000),
		});
		return {
			online: response.ok,
			detail: response.ok ? "TTS server reachable" : `HTTP ${response.status}`,
		};
	} catch {
		// Many gpt-sovits builds have no /api/health; a root probe is enough.
		try {
			const root = await fetchImpl(base, {
				method: "GET",
				signal: AbortSignal.timeout(4000),
			});
			return { online: root.status < 500, detail: `HTTP ${root.status}` };
		} catch (error) {
			return {
				online: false,
				detail: error instanceof Error ? error.message : "unreachable",
			};
		}
	}
}

/** Build a TTSConfig from a PrivseAI companion's voice hints. */
export function configForCompanion(
	companion: { name: string; voiceAudioUrl?: string },
	endpoint = DEFAULT_TTS_ENDPOINT,
): TTSConfig {
	return {
		endpoint,
		speaker: companion.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
		referenceAudio: companion.voiceAudioUrl || undefined,
		language: "auto",
	};
}
