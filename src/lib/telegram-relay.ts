/**
 * Telegram P2P Relay Bridge for privseai.com
 *
 * Relays Telegram messages through the Trystero P2P mesh,
 * so YuriOS companions on one device can receive messages
 * from Telegram users on another device without a central server.
 *
 * YuriOS exposes Telegram through:
 *   yurios pair -- prints QR and generates OWNER_TOKEN
 *   yurios settings HOST=0.0.0.0
 *
 * This bridge:
 * 1. Connects to YuriOS local API (port 8768)
 * 2. Routes Telegram messages through Trystero room
 * 3. Syncs messages P2P to other privseai.com peers
 */

import type { TrysteroP2PClient } from "@/lib/trystero-client";

export interface TelegramMessage {
	id: string;
	chatId: string;
	from: string;
	text: string;
	photo?: string;
	voice?: string;
	timestamp: number;
	isFromUser: boolean;
}

export interface TelegramConfig {
	yuriosApiUrl: string;
	ownerToken: string;
	pollingIntervalMs: number;
}

export class TelegramRelay {
	private client: TrysteroP2PClient | null = null;
	private config: TelegramConfig;
	private pollingTimer: ReturnType<typeof setInterval> | null = null;
	private messageHandlers: Set<(msg: TelegramMessage) => void> = new Set();
	private lastUpdateId = 0;

	constructor(config: TelegramConfig) {
		this.config = config;
	}

	setClient(client: TrysteroP2PClient): void {
		this.client = client;
		this.setupP2PActions();
	}

	private setupP2PActions(): void {
		if (!this.client) return;

		this.client.onColibriGateway((data, _peerId) => {
			const msg = data as TelegramMessage;
			if (msg && msg.text && msg.isFromUser) {
				for (const handler of this.messageHandlers) {
					handler(msg);
				}
			}
		});
	}

	onTelegramMessage(handler: (msg: TelegramMessage) => void): () => void {
		this.messageHandlers.add(handler);
		return () => {
			this.messageHandlers.delete(handler);
		};
	}

	startPolling(): void {
		if (this.pollingTimer) return;

		this.pollingTimer = setInterval(async () => {
			try {
				await this.pollUpdates();
			} catch (err) {
				console.error("Telegram polling error:", err);
			}
		}, this.config.pollingIntervalMs);
	}

	stopPolling(): void {
		if (this.pollingTimer) {
			clearInterval(this.pollingTimer);
			this.pollingTimer = null;
		}
	}

	private async pollUpdates(): Promise<void> {
		const res = await fetch(`${this.config.yuriosApiUrl}/api/telegram/updates?offset=${this.lastUpdateId + 1}`, {
			headers: {
				Authorization: `Bearer ${this.config.ownerToken}`,
			},
		});

		if (!res.ok) return;

		const data = await res.json() as {
			updates: TelegramMessage[];
			latestUpdateId: number;
		};

		for (const msg of data.updates) {
			this.relayToPeers(msg);
		}

		this.lastUpdateId = data.latestUpdateId;
	}

	private relayToPeers(msg: TelegramMessage): void {
		if (this.client) {
			this.client.broadcastImpact({
				target_id: msg.id,
				target_type: "event",
				tier: "low",
				score: 0.5,
				affected_agents: [],
				affected_domains: [],
				rationale: `Telegram message from ${msg.from}`,
				mitigations: [],
				generated_by: "telegram-relay",
				generated_at: new Date().toISOString(),
			});
		}

		for (const handler of this.messageHandlers) {
			handler(msg);
		}
	}

	async sendToTelegram(text: string, chatId: string): Promise<boolean> {
		try {
			const res = await fetch(`${this.config.yuriosApiUrl}/api/telegram/send`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${this.config.ownerToken}`,
				},
				body: JSON.stringify({ chat_id: chatId, text }),
			});
			return res.ok;
		} catch {
			return false;
		}
	}
}

export const createTelegramRelay = (
	yuriosUrl: string,
	ownerToken: string,
	client?: TrysteroP2PClient,
): TelegramRelay => {
	const relay = new TelegramRelay({
		yuriosApiUrl: yuriosUrl,
		ownerToken,
		pollingIntervalMs: 5000,
	});

	if (client) {
		relay.setClient(client);
	}

	return relay;
};
