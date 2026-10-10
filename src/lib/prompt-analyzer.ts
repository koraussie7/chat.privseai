export type PromptAnalysisMode = "image" | "enhance-image";

export interface PromptAnalysisInput {
	mode: PromptAnalysisMode;
	model: string;
	endpoint?: string;
	prompt?: string;
	image?: File;
	signal?: AbortSignal;
}

export interface PromptAnalysisResult {
	prompt: string;
	mode: PromptAnalysisMode;
	model: string;
	createdAt: number;
}

export class PromptAnalysisError extends Error {
	constructor(
		message: string,
		public readonly code: "missing-key" | "invalid-input" | "unauthorized" | "rate-limited" | "provider-error" | "empty-response",
	) {
		super(message);
		this.name = "PromptAnalysisError";
	}
}

const DEFAULT_MODEL = "gemini-2.5-flash";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_LENGTH = 12_000;
const API_BASE = "https://api.privseai.com/v1/prompt/analyze";

function buildInstruction(mode: PromptAnalysisMode, prompt: string): string {
	if (mode === "enhance-image") {
		return [
			"Expand the user's idea into one concise, detailed image-generation prompt.",
			"Specify subject, scene, composition, visual style, lighting, color palette, mood, texture/material, and perspective where relevant.",
			"Return only the final prompt. Do not add a preamble or markdown fences.",
			`User idea: ${prompt}`,
		].join("\n");
	}
	return [
		"Analyze the provided image and write one detailed, reusable image-generation prompt that could create a visually similar image.",
		"Describe only visible content: subject, scene, composition, style, lighting, palette, mood, texture/material, and perspective.",
		"Do not identify real people. Do not infer sensitive personal attributes. Return only the final prompt, without a preamble or markdown fences.",
	].join("\n");
}

/** Sends analysis input to PrivseAI API; the Gemini secret is server-side. */
export async function analyzePrompt(
	input: PromptAnalysisInput,
	fetchImpl: typeof fetch = fetch,
): Promise<PromptAnalysisResult> {

	const prompt = input.prompt?.trim() ?? "";
	if (input.mode === "enhance-image" && !prompt) {
		throw new PromptAnalysisError("Enter an idea to expand.", "invalid-input");
	}
	if (prompt.length > MAX_TEXT_LENGTH) {
		throw new PromptAnalysisError(`Keep the idea under ${MAX_TEXT_LENGTH} characters.`, "invalid-input");
	}
	if (input.mode === "image") {
		if (!input.image || !["image/jpeg", "image/png", "image/webp"].includes(input.image.type)) {
			throw new PromptAnalysisError("Choose a JPEG, PNG, or WebP image.", "invalid-input");
		}
		if (input.image.size > MAX_IMAGE_BYTES) {
			throw new PromptAnalysisError("Image must be 10 MB or smaller.", "invalid-input");
		}
	}
	const parts: Array<Record<string, unknown>> = [{ text: buildInstruction(input.mode, prompt) }];
	if (input.mode === "image" && input.image) {
		const bytes = new Uint8Array(await input.image.arrayBuffer());
		let binary = "";
		for (let i = 0; i < bytes.length; i += 0x8000) {
			binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
		}
		parts.push({ inline_data: { mime_type: input.image.type, data: btoa(binary) } });
	}
	const endpoint = input.endpoint ?? API_BASE;
	let parsedEndpoint: URL;
	try { parsedEndpoint = new URL(endpoint); } catch { throw new PromptAnalysisError("Analysis endpoint must be a valid URL.", "invalid-input"); }
	if (parsedEndpoint.origin !== "https://api.privseai.com" || parsedEndpoint.pathname !== "/v1/prompt/analyze") throw new PromptAnalysisError("Analysis endpoint must be the PrivseAI prompt API.", "invalid-input");
	let response: Response;
	try {
		response = await fetchImpl(endpoint, {
			method: "POST",
			signal: input.signal,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ mode: input.mode, model: input.model || DEFAULT_MODEL, prompt, image: input.mode === "image" ? parts[1]?.inline_data : undefined, contents: [{ role: "user", parts }] }),
		});
	} catch (error) {
		if (input.signal?.aborted) throw error;
		throw new PromptAnalysisError("Could not reach Gemini. Check your connection and try again.", "provider-error");
	}
	if (response.status === 401 || response.status === 403) {
		throw new PromptAnalysisError("Gemini authentication failed at the PrivseAI API.", "unauthorized");
	}
	if (response.status === 429) {
		throw new PromptAnalysisError("The configured Gemini quota or rate limit was reached.", "rate-limited");
	}
	if (!response.ok) throw new PromptAnalysisError(`PrivseAI analysis request failed (HTTP ${response.status}).`, "provider-error");
	const json = (await response.json()) as {
		prompt?: string;
		candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
	};
	const result = json.prompt?.trim() || json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
	if (!result) throw new PromptAnalysisError("PrivseAI analysis API returned no prompt. Try again with a different input.", "empty-response");
	return { prompt: result, mode: input.mode, model: input.model || DEFAULT_MODEL, createdAt: Date.now() };
}

export const PROMPT_ANALYSIS_MODELS = ["gemini-2.5-flash", "gemini-2.5-pro"] as const;
export const PROMPT_ANALYZER_LIMITS = { maxImageBytes: MAX_IMAGE_BYTES, maxTextLength: MAX_TEXT_LENGTH } as const;
