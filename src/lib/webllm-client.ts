/**
 * WebLLM Client for privseai.com
 *
 * Uses MLC WebLLM for WebGPU-accelerated browser LLM inference.
 * Supports models from the WebLLM catalog.
 */

export interface WebLLMGenerateOptions {
	maxTokens?: number;
	temperature?: number;
	topP?: number;
	stream?: boolean;
	onToken?: (token: string) => void;
}

export interface WebLLMGenerateResult {
	text: string;
	tokensGenerated: number;
	tokensPerSecond: number;
	model: string;
	error?: string;
}

export interface ModelInfo {
	id: string;
	name: string;
	size: string;
	description: string;
	recommended: boolean;
}

const AVAILABLE_MODELS: ModelInfo[] = [
	{
		id: "Llama-3.2-1B-Instruct-q4f32_1",
		name: "Llama 3.2 1B (Q4)",
		size: "~0.8GB",
		description: "Fast, good quality — best for mobile",
		recommended: true,
	},
	{
		id: "Phi-3-mini-4k-instruct-q4f32_1",
		name: "Phi-3-mini (Q4)",
		size: "~2.5GB",
		description: "High quality, Microsoft model",
		recommended: true,
	},
	{
		id: "Qwen2.5-0.5B-Instruct-q4f32_1",
		name: "Qwen2.5-0.5B (Q4)",
		size: "~0.4GB",
		description: "Smallest, fastest — for low-end devices",
		recommended: true,
	},
	{
		id: "Llama-3.1-8B-Instruct-q4f32_1",
		name: "Llama 3.1 8B (Q4)",
		size: "~5GB",
		description: "Premium quality, requires high-end GPU",
		recommended: false,
	},
];

export class WebLLMClient {
	private modelId: string;
	private engine: unknown = null;
	private isLoading = false;
	private loadProgress = 0;

	constructor(modelId = "Llama-3.2-1B-Instruct-q4f32_1") {
		this.modelId = modelId;
	}

	static getAvailableModels(): ModelInfo[] {
		return AVAILABLE_MODELS;
	}

	getModelId(): string {
		return this.modelId;
	}

	setModel(modelId: string): void {
		if (this.modelId !== modelId) {
			this.modelId = modelId;
			this.engine = null;
		}
	}

	getLoadingState(): { isLoading: boolean; progress: number } {
		return { isLoading: this.isLoading, progress: this.loadProgress };
	}

	/**
	 * Initialize the WebLLM engine
	 */
	async initialize(
		onProgress?: (state: { progress: number; text: string; status: "loading" | "ready" }) => void,
	): Promise<void> {
		if (this.engine) return;

		this.isLoading = true;
		this.loadProgress = 0;

		try {
			// Dynamic import to avoid SSR issues. The specifier is held in a
			// variable and marked @vite-ignore so Vite does NOT statically
			// resolve/bundle it (the optional @mlc-ai/web-llm package may not be
			// installed; inlining it would break the app on load). If it is
			// missing at runtime, on-device WebLLM is skipped and the caller falls
			// back to the remote OpenAI proxy. To enable it:
			//   npm i @mlc-ai/web-llm
			const specifier = "@mlc-ai/web-llm";
			const mod = await import(/* @vite-ignore */ specifier);

			this.engine = await mod.CreateMLCEngine(this.modelId, {
				initProgressCallback: (report: { progress: number; text: string }) => {
					this.loadProgress = Math.round(report.progress * 100);
					console.log(
						`[WebLLM] Loading ${this.modelId}: ${report.text} (${this.loadProgress}%)`,
					);
				},
			});

			this.loadProgress = 100;
			this.isLoading = false;
			onProgress?.({ progress: 1, text: "Local model ready", status: "ready" });
			console.log(`[WebLLM] Model ${this.modelId} loaded successfully`);
		} catch (error) {
			this.isLoading = false;
			this.loadProgress = 0;
			console.error("[WebLLM] Failed to load model:", error);
			throw error;
		}
	}

	/**
	 * Generate text using WebLLM
	 */
	async chat(
		messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
		options: WebLLMGenerateOptions = {},
	): Promise<WebLLMGenerateResult> {
		const startTime = Date.now();

		if (!this.engine) {
			await this.initialize();
		}

		if (!this.engine) {
			return {
				text: "",
				tokensGenerated: 0,
				tokensPerSecond: 0,
				model: this.modelId,
				error: "Engine not initialized",
			};
		}

		const { maxTokens = 512, temperature = 0.7, topP = 0.9, onToken } = options;

		try {
			// @ts-expect-error - WebLLM engine type
			const completion = await this.engine.chat.completions.create({
				messages: messages.map((m) => ({
					role: m.role,
					content: m.content,
				})),
				max_tokens: maxTokens,
				temperature,
				top_p: topP,
				stream: !!onToken,
			});

			let fullText = "";
			let tokensGenerated = 0;

			if (onToken && completion[Symbol.asyncIterator]) {
				// Streaming response
				for await (const chunk of completion) {
					const token = chunk.choices[0]?.delta?.content || "";
					if (token) {
						fullText += token;
						tokensGenerated++;
						onToken(token);
					}
				}
			} else {
				// Non-streaming response
				fullText = completion.choices[0]?.message?.content || "";
				tokensGenerated = this.estimateTokens(fullText);
			}

			const elapsed = Date.now() - startTime;
			const tokensPerSecond = elapsed > 0 ? (tokensGenerated / elapsed) * 1000 : 0;

			return {
				text: fullText,
				tokensGenerated,
				tokensPerSecond,
				model: this.modelId,
			};
		} catch (error) {
			console.error("[WebLLM] Generation error:", error);
			return {
				text: "",
				tokensGenerated: 0,
				tokensPerSecond: 0,
				model: this.modelId,
				error: error instanceof Error ? error.message : "Generation failed",
			};
		}
	}

	/**
	 * Rough token estimation
	 */
	private estimateTokens(text: string): number {
		const koreanChars = (text.match(/[ㄱ-ㅎㅏ-ㅣ가-힣]/g) || []).length;
		const otherChars = text.length - koreanChars;
		return Math.round(koreanChars / 2 + otherChars / 4);
	}

	/**
	 * Unload model to free memory
	 */
	async unload(): Promise<void> {
		if (this.engine) {
			// @ts-expect-error
			await this.engine.unload();
			this.engine = null;
		}
	}
}

// Singleton instance
let _webLLM: WebLLMClient | null = null;

export function getWebLLM(modelId?: string): WebLLMClient {
	if (!_webLLM) {
		_webLLM = new WebLLMClient(modelId);
	}
	return _webLLM;
}

export function resetWebLLM(): void {
	if (_webLLM) {
		_webLLM.unload();
		_webLLM = null;
	}
}