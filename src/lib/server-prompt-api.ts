import type { PromptAnalysisMode, PromptAnalysisResult } from "@/lib/prompt-analyzer";

const DEFAULT_BASE_URL = "https://api.privseai.com";

/** Browser client for the PrivseAI server-side Gemini proxy. Does not accept/store provider secrets. */
export async function requestPromptAnalysis(
	input: { mode: PromptAnalysisMode; model: string; prompt?: string; image?: File; signal?: AbortSignal },
	fetchImpl: typeof fetch = fetch,
): Promise<PromptAnalysisResult> {
	const parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [];
	if (input.prompt?.trim()) parts.push({ text: input.prompt.trim() });
	if (input.image) {
		const bytes = new Uint8Array(await input.image.arrayBuffer());
		let binary = "";
		for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
		parts.push({ inline_data: { mime_type: input.image.type, data: btoa(binary) } });
	}
	const response = await fetchImpl(`${DEFAULT_BASE_URL}/v1/prompt/analyze`, {
		method: "POST",
		signal: input.signal,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ mode: input.mode, model: input.model, parts }),
	});
	if (!response.ok) {
		const code = response.status === 401 || response.status === 403 ? "unauthorized" : response.status === 429 ? "rate-limited" : "provider-error";
		throw new Error(`PrivseAI prompt analysis failed (HTTP ${response.status}, ${code}).`);
	}
	const data = await response.json() as { prompt?: string; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
	const result = data.prompt?.trim() || data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
	if (!result) throw new Error("PrivseAI analysis endpoint returned no prompt.");
	return { prompt: result, mode: input.mode, model: input.model, createdAt: Date.now() };
}
