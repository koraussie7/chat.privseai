/**
 * On-Device LLM Client for privseai.com
 *
 * Uses Transformers.js (Xenova) for browser-based LLM inference.
 * Supports quantized models (Q4, Q8) for efficient browser inference.
 *
 * Models supported:
 * - Xenova/Phi-3-mini-4k-instruct-q4 (3.8B params, ~2.3GB)
 * - Xenova/Llama-3.2-1B-Instruct-q4 (1B params, ~0.7GB)
 * - Xenova/SmolLM2-1.7B-Instruct-q4 (1.7B params, ~1.1GB)
 * - Xenova/Qwen2.5-0.5B-Instruct-q4 (0.5B params, ~0.4GB)
 */

import {
	type GenerationOptions,
	type TextGenerationPipeline,
	pipeline,
} from "@xenova/transformers";

export interface OnDeviceGenerateOptions {
	maxTokens?: number;
	temperature?: number;
	topP?: number;
	topK?: number;
	seed?: number;
	stream?: boolean;
	onToken?: (token: string) => void;
}

export interface OnDeviceGenerateResult {
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
		id: "Xenova/Qwen2.5-0.5B-Instruct-q4",
		name: "Qwen2.5-0.5B (Q4)",
		size: "~400MB",
		description: "Fastest, good for basic chat",
		recommended: true,
	},
	{
		id: "Xenova/SmolLM2-1.7B-Instruct-q4",
		name: "SmolLM2-1.7B (Q4)",
		size: "~1.1GB",
		description: "Balanced quality/speed",
		recommended: true,
	},
	{
		id: "Xenova/Phi-3-mini-4k-instruct-q4",
		name: "Phi-3-mini (Q4)",
		size: "~2.3GB",
		description: "High quality, slower",
		recommended: false,
	},
	{
		id: "Xenova/Llama-3.2-1B-Instruct-q4",
		name: "Llama-3.2-1B (Q4)",
		size: "~700MB",
		description: "Good quality, fast",
		recommended: true,
	},
];

const NSFW_MODELS: ModelInfo[] = [
	{
		id: "Xenova/LLaMA-2-7B-chat-hf.Q4_K_M",
		name: "LLaMA-2-7B NSFW (Q4)",
		size: "~4.2GB",
		description: "NSFW-tuned 7B model — mature, unfiltered conversation",
		recommended: false,
	},
	{
		id: "TheBloke/Yarn-Llama-2-13B-64K-Q4_K_M",
		name: "Yarn-Llama-2-13B NSFW (Q4)",
		size: "~7.5GB",
		description: "13B NSFW model with 64K context — premium adult roleplay",
		recommended: false,
	},
	{
		id: "Xenova/Qwen2.5-7B-Instruct-Q4_K_M",
		name: "Qwen2.5-7B NSFW (Q4)",
		size: "~4.3GB",
		description: "7B model tuned for mature conversation — balanced quality",
		recommended: true,
	},
	{
		id: "Xenova/SmolLM2-1.7B-Instruct-q4-nsfw",
		name: "SmolLM2-1.7B NSFW (Q4)",
		size: "~1.1GB",
		description: "Lightweight 1.7B NSFW model — fast, private adult chat",
		recommended: true,
	},
];

export class OnDeviceLLMClient {
	private modelId: string;
	private generator: TextGenerationPipeline | null = null;
	private isLoading = false;
	private loadProgress = 0;

	constructor(modelId = "Xenova/Qwen2.5-0.5B-Instruct-q4") {
		this.modelId = modelId;
	}

	static getAvailableModels(): ModelInfo[] {
		return AVAILABLE_MODELS;
	}

	static getNSFWModels(): ModelInfo[] {
		return NSFW_MODELS;
	}

	getModelId(): string {
		return this.modelId;
	}

	setModel(modelId: string): void {
		if (this.modelId !== modelId) {
			this.modelId = modelId;
			this.generator = null; // Force reload
		}
	}

	getLoadingState(): { isLoading: boolean; progress: number } {
		return { isLoading: this.isLoading, progress: this.loadProgress };
	}

	/**
	 * Initialize the model pipeline (lazy loading)
	 */
	async initialize(): Promise<void> {
		if (this.generator) return;

		this.isLoading = true;
		this.loadProgress = 0;

		try {
			// Configure transformers.js
			if (typeof globalThis !== "undefined") {
				// @ts-expect-error - extending globalThis with transformers config
				globalThis.transformers = globalThis.transformers || {};
				// @ts-expect-error
				globalThis.transformers.cacheDir = "/models/transformers";
			}

			// Create the text generation pipeline
			this.generator = await pipeline("text-generation", this.modelId, {
				device: "webgpu", // Try WebGPU first, fallback to wasm
				dtype: "q4", // Use 4-bit quantization
				progress_callback: (progress: { progress: number; status: string }) => {
					this.loadProgress = Math.round(progress.progress * 100);
					console.log(
						`[OnDeviceLLM] Loading ${this.modelId}: ${progress.status} (${this.loadProgress}%)`,
					);
				},
			});

			this.loadProgress = 100;
			this.isLoading = false;
			console.log(`[OnDeviceLLM] Model ${this.modelId} loaded successfully`);
		} catch (error) {
			this.isLoading = false;
			this.loadProgress = 0;
			console.error("[OnDeviceLLM] Failed to load model:", error);
			throw error;
		}
	}

	/**
	 * Generate text using the on-device model
	 */
	async generate(
		prompt: string,
		options: OnDeviceGenerateOptions = {},
	): Promise<OnDeviceGenerateResult> {
		const startTime = Date.now();

		if (!this.generator) {
			await this.initialize();
		}

		if (!this.generator) {
			return {
				text: "",
				tokensGenerated: 0,
				tokensPerSecond: 0,
				model: this.modelId,
				error: "Model not initialized",
			};
		}

		const { maxTokens = 512, temperature = 0.7, topP = 0.9, topK = 50, onToken } = options;

		try {
			const messages = [
				{
					role: "system",
					content:
						"You are a helpful, friendly AI companion. Respond naturally and conversationally.",
				},
				{ role: "user", content: prompt },
			];

			const generationOptions: GenerationOptions = {
				max_new_tokens: maxTokens,
				temperature,
				top_p: topP,
				top_k: topK,
				do_sample: temperature > 0,
				repetition_penalty: 1.1,
			};

			const result = await this.generator(messages, generationOptions);
			const generatedText = result[0]?.generated_text || "";
			const assistantResponse = this.extractAssistantResponse(generatedText, prompt);

			if (onToken) {
				// Emit tokens character by character as a rough approximation
				for (const char of assistantResponse) {
					onToken(char);
				}
			}

			const elapsed = Date.now() - startTime;
			const tokensGenerated = this.estimateTokens(assistantResponse);
			const tokensPerSecond = (tokensGenerated / elapsed) * 1000;

			return {
				text: assistantResponse,
				tokensGenerated,
				tokensPerSecond,
				model: this.modelId,
			};
		} catch (error) {
			console.error("[OnDeviceLLM] Generation error:", error);
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
	 * Extract only the assistant's response from the generated text
	 */
	private extractAssistantResponse(generatedText: string, originalPrompt: string): string {
		// Try to find the assistant's response after the user prompt
		const promptEnd = generatedText.lastIndexOf(originalPrompt);
		if (promptEnd !== -1) {
			const afterPrompt = generatedText.slice(promptEnd + originalPrompt.length);
			// Look for assistant markers
			const assistantMarkers = ["Assistant:", "assistant:", "AI:", "ai:"];
			for (const marker of assistantMarkers) {
				const idx = afterPrompt.indexOf(marker);
				if (idx !== -1) {
					return afterPrompt.slice(idx + marker.length).trim();
				}
			}
			// If no marker, return everything after the prompt
			return afterPrompt.trim();
		}
		return generatedText.trim();
	}

	/**
	 * Rough token estimation (4 chars ≈ 1 token for English, 2 chars ≈ 1 token for Korean)
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
		this.generator = null;
		// Force garbage collection hint
		if (typeof globalThis !== "undefined" && "gc" in globalThis) {
			// @ts-ignore
			globalThis.gc?.();
		}
	}
}

// Singleton instance
let _onDeviceLLM: OnDeviceLLMClient | null = null;

export function getOnDeviceLLM(modelId?: string): OnDeviceLLMClient {
	if (!_onDeviceLLM) {
		_onDeviceLLM = new OnDeviceLLMClient(modelId);
	}
	return _onDeviceLLM;
}

export function resetOnDeviceLLM(): void {
	if (_onDeviceLLM) {
		_onDeviceLLM.unload();
		_onDeviceLLM = null;
	}
}
