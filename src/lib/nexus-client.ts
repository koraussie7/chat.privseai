/**
 * Nexus Client — connects to a user-hosted Nexus instance (Ollama/vLLM/LM Studio
 * running behind an OpenAI-compatible API).
 *
 * Devices are persisted in localStorage so the pairing survives page reloads.
 * Each NexusConfig represents one paired Nexus endpoint.
 */

export interface NexusCapabilities {
	models: string[];
	maxTokens: number;
	supportsStreaming: boolean;
}

export interface NexusConfig {
	baseUrl: string;
	apiKey?: string;
	deviceId: string;
	deviceName: string;
	pairedAt: number;
	lastConnectedAt?: number;
	capabilities?: NexusCapabilities;
}

export interface NexusChatRequest {
	model: string;
	messages: Array<{
		role: "system" | "user" | "assistant";
		content: string;
	}>;
	temperature: number;
	max_tokens: number;
	top_p: number;
	stream?: boolean;
	signal?: AbortSignal;
}

export interface NexusConnectionStatus {
	online: boolean;
	version?: string;
	models?: string[];
	error?: string;
}

export interface NexusChatResponse {
	id: string;
	choices: Array<{
		index: number;
		message: { role: string; content: string };
		finish_reason: string;
	}>;
	model?: string;
}

export interface NexusStreamChunk {
	content: string;
	done: boolean;
}

const STORAGE_KEY_DEVICES = "privseai_nexus_devices";
const STORAGE_KEY_ACTIVE = "privseai_nexus_active";
const RECONNECT_MAX_RETRIES = 3;
const RECONNECT_BASE_DELAY = 1000;

export function generateDeviceId(): string {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return `nexus_${crypto.randomUUID()}`;
	}
	return `nexus_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function validateNexusUrl(url: string): { valid: boolean; error?: string } {
	try {
		const parsed = new URL(url);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			return { valid: false, error: "URL must use http or https protocol" };
		}
		if (!parsed.hostname) {
			return { valid: false, error: "URL must include a hostname" };
		}
		return { valid: true };
	} catch {
		return { valid: false, error: "Invalid URL format" };
	}
}

export class NexusClient {
	private config: NexusConfig;
	private controller: AbortController | null = null;
	private reconnectAttempts = 0;

	constructor(config: NexusConfig) {
		this.config = config;
	}

	getConfig(): NexusConfig {
		return this.config;
	}

	getHeaders(): Record<string, string> {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};
		if (this.config.apiKey) {
			headers.Authorization = `Bearer ${this.config.apiKey}`;
		}
		return headers;
	}

	private get abortSignal(): AbortSignal | undefined {
		return this.controller?.signal;
	}

	async fetch(input: string | URL, init?: RequestInit): Promise<Response> {
		const url = typeof input === "string" ? input : input.toString();
		const response = await fetch(url, {
			...init,
			headers: { ...this.getHeaders(), ...(init?.headers ?? {}) },
		});
		return response;
	}

	private buildUrl(path: string): string {
		const base = this.config.baseUrl.replace(/\/$/, "");
		return `${base}${path.startsWith("/") ? path : `/${path}`}`;
	}

	async checkConnection(): Promise<NexusConnectionStatus> {
		try {
			const res = await fetch(this.buildUrl("/v1/models"), {
				headers: this.getHeaders(),
				signal: AbortSignal.timeout(5000),
			});

			if (!res.ok) {
				const body = await res.text().catch(() => "");
				return { online: false, error: `HTTP ${res.status}: ${body}` };
			}

			const data = (await res.json().catch(() => null)) as
				| { data?: Array<{ id: string }> }
				| null;
			const models = data?.data?.map((m) => m.id) ?? [];

			let version: string | undefined;
			try {
				const verRes = await fetch(this.buildUrl("/"), {
					headers: this.getHeaders(),
					signal: AbortSignal.timeout(3000),
				});
				if (verRes.ok) {
					const verData = (await verRes.json().catch(() => null)) as
						| { version?: string }
						| null;
					version = verData?.version;
				}
			} catch {
				/* version is optional */
			}

			const updated = {
				...this.config,
				lastConnectedAt: Date.now(),
				capabilities: {
					models,
					maxTokens: 4096,
					supportsStreaming: true,
				},
			};
			NexusClient.storeDevice(updated);

			return { online: true, version, models };
		} catch (error) {
			return {
				online: false,
				error: error instanceof Error ? error.message : "Connection failed",
			};
		}
	}

	async listModels(): Promise<string[]> {
		const status = await this.checkConnection();
		return status.models ?? [];
	}

	private cancelReconnect() {
		this.reconnectAttempts = 0;
	}

	private startReconnect(): boolean {
		if (this.reconnectAttempts >= RECONNECT_MAX_RETRIES) {
			return false;
		}
		this.reconnectAttempts++;
		return true;
	}

	async ensureConnected(retries = 3): Promise<boolean> {
		const status = await this.checkConnection();
		if (status.online) {
			this.cancelReconnect();
			return true;
		}

		for (let i = 0; i < retries; i++) {
			if (!this.startReconnect()) break;
			const delay = RECONNECT_BASE_DELAY * Math.pow(2, i);
			await new Promise((resolve) => setTimeout(resolve, delay));
			const retry = await this.checkConnection();
			if (retry.online) {
				this.cancelReconnect();
				return true;
			}
		}

		this.cancelReconnect();
		return false;
	}

	async chat(request: NexusChatRequest): Promise<NexusChatResponse> {
		const res = await fetch(this.buildUrl("/v1/chat/completions"), {
			method: "POST",
			headers: this.getHeaders(),
			body: JSON.stringify({
				model: request.model,
				messages: request.messages,
				temperature: request.temperature,
				max_tokens: request.max_tokens,
				top_p: request.top_p,
				stream: false,
			}),
			signal: request.signal ?? this.abortSignal,
		});

		if (!res.ok) {
			const body = await res.text().catch(() => "");
			throw new Error(`Nexus chat error: HTTP ${res.status}: ${body}`);
		}

		const data = (await res.json()) as NexusChatResponse;
		return data;
	}

	async *chatStream(
		request: NexusChatRequest,
	): AsyncGenerator<NexusStreamChunk, void, unknown> {
		const res = await fetch(this.buildUrl("/v1/chat/completions"), {
			method: "POST",
			headers: {
				...this.getHeaders(),
				Accept: "text/event-stream",
			},
			body: JSON.stringify({
				model: request.model,
				messages: request.messages,
				temperature: request.temperature,
				max_tokens: request.max_tokens,
				top_p: request.top_p,
				stream: true,
			}),
			signal: request.signal ?? this.abortSignal,
		});

		if (!res.ok) {
			const body = await res.text().catch(() => "");
			throw new Error(`Nexus stream error: HTTP ${res.status}: ${body}`);
		}

		const reader = res.body?.getReader();
		if (!reader) {
			throw new Error("Response body is not readable");
		}

		const decoder = new TextDecoder("utf-8");

		try {
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = decoder.decode(value, { stream: true });
				const lines = chunk.split("\n").filter((line) => line.trim());

				for (const line of lines) {
					if (line.startsWith("data: ")) {
						const data = line.slice(6).trim();
						if (data === "[DONE]") {
							yield { content: "", done: true };
							return;
						}
						try {
							const parsed = JSON.parse(data) as {
								choices?: Array<{
									delta?: { content?: string };
									finish_reason?: string;
								}>;
							};
							const content = parsed.choices?.[0]?.delta?.content;
							if (content) {
								yield { content, done: false };
							}
						} catch {
							/* skip malformed SSE lines */
						}
					}
				}
			}
		} finally {
			reader.releaseLock();
		}

		yield { content: "", done: true };
	}

	/* ---------- Static persistence helpers ---------- */

	static getStoredDevices(): NexusConfig[] {
		try {
			const raw = localStorage.getItem(STORAGE_KEY_DEVICES);
			if (!raw) return [];
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) return [];
			return parsed as NexusConfig[];
		} catch {
			return [];
		}
	}

	static storeDevice(device: NexusConfig): void {
		try {
			const devices = NexusClient.getStoredDevices();
			const idx = devices.findIndex((d) => d.deviceId === device.deviceId);
			if (idx >= 0) {
				devices[idx] = device;
			} else {
				devices.push(device);
			}
			localStorage.setItem(STORAGE_KEY_DEVICES, JSON.stringify(devices));
		} catch {
			/* ignore write errors */
		}
	}

	static getActiveDevice(): NexusConfig | null {
		try {
			const activeId = localStorage.getItem(STORAGE_KEY_ACTIVE);
			if (!activeId) return null;
			const devices = NexusClient.getStoredDevices();
			return devices.find((d) => d.deviceId === activeId) ?? null;
		} catch {
			return null;
		}
	}

	static setActiveDevice(deviceId: string | null): void {
		try {
			if (deviceId === null) {
				localStorage.removeItem(STORAGE_KEY_ACTIVE);
			} else {
				localStorage.setItem(STORAGE_KEY_ACTIVE, deviceId);
			}
		} catch {
			/* ignore write errors */
		}
	}

	static removeDevice(deviceId: string): void {
		try {
			const devices = NexusClient.getStoredDevices().filter(
				(d) => d.deviceId !== deviceId,
			);
			localStorage.setItem(STORAGE_KEY_DEVICES, JSON.stringify(devices));
			if (NexusClient.getActiveDevice()?.deviceId === deviceId) {
				NexusClient.setActiveDevice(null);
			}
		} catch {
			/* ignore write errors */
		}
	}
}
