/**
 * Girlfriend.ai integration for privseai.com chat.
 *
 * Provides an additional inference tier in the fallback chain:
 *
 *   1. api.privseai.com/v1/chat/completions (primary)
 *   2. Colibri WASM (localhost:3001)
 *   3. Girlfriend.ai local server (configurable)
 *   4. Offline keyword fallback (last resort)
 *
 * Usage: Run girlfriend.ai locally, then it will be auto-discovered
 * and used as a fallback inference engine when the primary API is unavailable.
 */

export interface GirlfriendAIConfig {
	baseUrl: string;
	apiKey?: string;
	model?: string;
}

export interface GirlfriendAIChatRequest {
	message: string;
	user_id?: string;
	persona_id?: string;
	history?: Array<{ role: "user" | "assistant"; content: string }>;
	temperature?: number;
	max_tokens?: number;
}

export interface GirlfriendAIChatResponse {
	reply: string;
	usage?: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
	model?: string;
}

const DEFAULT_CONFIG: GirlfriendAIConfig = {
	baseUrl: "http://localhost:8080",
	model: "girlfriend-ai-v1",
};

export class GirlfriendAIClient {
	private config: GirlfriendAIConfig;

	constructor(config: Partial<GirlfriendAIConfig> = {}) {
		this.config = {
			...DEFAULT_CONFIG,
			...config,
			baseUrl:
				config.baseUrl?.replace(/\/$/, "") ??
				(import.meta as {
					env?: { VITE_GIRLFRIEND_AI_URL?: string };
				}).env?.VITE_GIRLFRIEND_AI_URL ??
				DEFAULT_CONFIG.baseUrl,
		};
	}

	getBaseUrl(): string {
		return this.config.baseUrl;
	}

	async getConfig(): Promise<{
		online: boolean;
		endpoints: string[];
		personas?: string[];
	}> {
		try {
			const res = await fetch(`${this.config.baseUrl}/`, {
				signal: AbortSignal.timeout(3000),
			});
			if (!res.ok) {
				return { online: false, endpoints: [] };
			}
			const data = (await res.json()) as {
				endpoints?: string[];
				personas?: string[];
			};
			return {
				online: true,
				endpoints: data.endpoints ?? ["/api/chat", "/api/persona"],
				personas: data.personas,
			};
		} catch {
			return { online: false, endpoints: [] };
		}
	}

	async chat(opts: {
		message: string;
		history?: Array<{ role: "user" | "assistant"; content: string }>;
		personaId?: string;
		temperature?: number;
		maxTokens?: number;
	}): Promise<GirlfriendAIChatResponse | null> {
		try {
			const headers: Record<string, string> = {
				"Content-Type": "application/json",
			};
			if (this.config.apiKey) {
				headers.Authorization = `Bearer ${this.config.apiKey}`;
			}

			const requestBody: GirlfriendAIChatRequest = {
				message: opts.message,
				history: opts.history?.map((h) => ({
					role: h.role,
					content: h.content,
				})),
				temperature: opts.temperature ?? 0.7,
				max_tokens: opts.maxTokens ?? 512,
			};

			if (opts.personaId) {
				requestBody.persona_id = opts.personaId;
			}

			const res = await fetch(`${this.config.baseUrl}/api/chat`, {
				method: "POST",
				headers,
				body: JSON.stringify(requestBody),
				signal: AbortSignal.timeout(15000),
			});

			if (!res.ok) {
				return null;
			}

 			const data = (await res.json()) as {
				reply?: string;
				response?: string;
				content?: string;
				choices?: Array<{ message?: { content?: string } }>;
				usage?: Record<string, number>;
				model?: string;
			};

			const replyText =
				data.reply ?? data.response ?? data.content ??
				data.choices?.[0]?.message?.content ?? "";

			return {
				reply: replyText,
				usage: data.usage
					? {
							prompt_tokens: data.usage.prompt_tokens ?? 0,
							completion_tokens: data.usage.completion_tokens ?? 0,
							total_tokens: data.usage.total_tokens ?? 0,
						}
					: undefined,
				model: data.model,
			};
		} catch {
			return null;
		}
	}

	async listPersonas(): Promise<
		Array<{ id: string; name: string; description?: string }>
	> {
		try {
			const res = await fetch(`${this.config.baseUrl}/api/personas`, {
				signal: AbortSignal.timeout(3000),
			});
			if (!res.ok) return [];
			return (await res.json()) as Array<{
				id: string;
				name: string;
				description?: string;
			}>;
		} catch {
			return [];
		}
	}
}

export { DEFAULT_CONFIG };
