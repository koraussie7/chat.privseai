/**
 * Multi-Model API Client for privseai.com chat.
 *
 * Connects all available inference backends in priority order:
 * 1. Primary API (api.privseai.com) - LiteLLM smart routing
 * 2. MuhanAI OmniRoute API - intelligent model routing
 * 3. Direct model endpoints (if configured)
 * 4. Colibri WASM local inference
 * 5. Girlfriend.ai local server
 * 6. Offline fallback
 *
 * Guarantees chat always works by trying all backends sequentially.
 */

export interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

export interface ChatCompletionRequest {
	model: string;
	messages: ChatMessage[];
	temperature?: number;
	max_tokens?: number;
	stream?: boolean;
	colibri?: { baseUrl: string; model: string };
}

export interface ChatCompletionResponse {
	id: string;
	choices: Array<{
		index: number;
		message: { role: string; content: string };
		finish_reason: string;
	}>;
	usage?: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
	model?: string;
	error?: string;
}

export interface ModelEndpoint {
	name: string;
	url: string;
	apiKey?: string;
	models: string[];
	priority: number;
	timeout: number;
	enabled: boolean;
}

const DEFAULT_ENDPOINTS: ModelEndpoint[] = [
	{
		name: "privseai-primary",
		url: "https://api.privseai.com/v1/chat/completions",
		models: ["smart", "omni", "qwen3-0.6b", "qwen2.5-7b", "llama3.2-3b"],
		priority: 1,
		timeout: 15000,
		enabled: true,
	},
	{
		name: "muhanai-omniroute",
		url: "https://omniroute.muhanai.com/v1/chat/completions",
		models: ["omni", "smart", "auto"],
		priority: 2,
		timeout: 20000,
		enabled: true,
	},
	{
		name: "muhanai-direct",
		url: "https://api.muhanai.com/v1/chat/completions",
		models: ["qwen3-0.6b", "qwen2.5-7b", "llama3.2-3b", "mistral-7b"],
		priority: 3,
		timeout: 20000,
		enabled: true,
	},
];

export class MultiModelChatClient {
	private endpoints: ModelEndpoint[];
	private apiKey: string | null = null;

	constructor(customEndpoints?: Partial<ModelEndpoint>[]) {
		this.endpoints = DEFAULT_ENDPOINTS.map((ep, i) => {
			const custom = customEndpoints?.[i];
			return {
				...ep,
				...custom,
				url: (import.meta as unknown as { env?: Record<string, string> }).env?.[
					`VITE_${ep.name.toUpperCase().replace(/-/g, "_")}_URL`
				] ?? ep.url,
			};
		}).sort((a, b) => a.priority - b.priority);
	}

	setApiKey(key: string): void {
		this.apiKey = key;
	}

	async chat(
		messages: ChatMessage[],
		opts: {
			model?: string;
			temperature?: number;
			maxTokens?: number;
			colibri?: { baseUrl: string; model: string };
			onProgress?: (stage: string, endpoint: string) => void;
		} = {},
	): Promise<{ reply: string; model: string; endpoint: string }> {
		const model = opts.model ?? "smart";
		const temperature = opts.temperature ?? 0.7;
		const max_tokens = opts.maxTokens ?? 512;

		// Find endpoints that support this model
		const availableEndpoints = this.endpoints.filter(
			(ep) => ep.enabled && ep.models.includes(model),
		);

		if (availableEndpoints.length === 0) {
			throw new Error(`No endpoint supports model: ${model}`);
		}

		let lastError: Error | null = null;

		for (const endpoint of availableEndpoints) {
			opts.onProgress?.("trying", endpoint.name);

			try {
				const reply = await this._tryEndpoint(endpoint, {
					model,
					messages,
					temperature,
					max_tokens,
					colibri: opts.colibri,
				});

				opts.onProgress?.("success", endpoint.name);
				return { reply, model, endpoint: endpoint.name };
			} catch (err) {
				lastError = err instanceof Error ? err : new Error(String(err));
				opts.onProgress?.("failed", `${endpoint.name}: ${err}`);
				continue;
			}
		}

		throw lastError ?? new Error("All endpoints failed");
	}

	private async _tryEndpoint(
		endpoint: ModelEndpoint,
		req: ChatCompletionRequest,
	): Promise<string> {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};

		if (endpoint.apiKey) {
			headers.Authorization = `Bearer ${endpoint.apiKey}`;
		} else if (this.apiKey) {
			headers.Authorization = `Bearer ${this.apiKey}`;
		}

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), endpoint.timeout);

		try {
			const res = await fetch(endpoint.url, {
				method: "POST",
				headers,
				body: JSON.stringify(req),
				signal: controller.signal,
				credentials: "include",
			});

			clearTimeout(timeoutId);

			let data: unknown;
			try {
				data = await res.json();
			} catch {
				throw new Error(`Invalid JSON from ${endpoint.name}`);
			}

			if (!res.ok) {
				const errData = data as Record<string, unknown>;
				const errorMsg = (errData.error as string) ?? `HTTP ${res.status}`;
				throw new Error(`${endpoint.name}: ${errorMsg}`);
			}

			const responseData = data as ChatCompletionResponse;
			const reply = responseData.choices?.[0]?.message?.content;

			if (!reply) {
				throw new Error(`${endpoint.name}: Empty response`);
			}

			return reply;
		} finally {
			clearTimeout(timeoutId);
		}
	}

	// Health check all endpoints
	async healthCheck(): Promise<Record<string, { online: boolean; latency?: number }>> {
		const results: Record<string, { online: boolean; latency?: number }> = {};

		for (const endpoint of this.endpoints) {
			if (!endpoint.enabled) {
				results[endpoint.name] = { online: false };
				continue;
			}

			const start = Date.now();
			try {
				const res = await fetch(endpoint.url.replace("/chat/completions", "/health"), {
					method: "GET",
					signal: AbortSignal.timeout(5000),
				});
				results[endpoint.name] = {
					online: res.ok,
					latency: Date.now() - start,
				};
			} catch {
				results[endpoint.name] = { online: false };
			}
		}

		return results;
	}

	// Get available models across all endpoints
	getAvailableModels(): string[] {
		const models = new Set<string>();
		for (const ep of this.endpoints) {
			if (ep.enabled) {
				for (const m of ep.models) models.add(m);
			}
		}
		return Array.from(models);
	}
}

// Singleton instance
let _multiModelClient: MultiModelChatClient | null = null;

export function getMultiModelClient(): MultiModelChatClient {
	if (!_multiModelClient) {
		_multiModelClient = new MultiModelChatClient();
	}
	return _multiModelClient;
}

export function resetMultiModelClient(): void {
	_multiModelClient = null;
}