/**
 * Trystero P2P client for privseai.com.
 *
 * Bridges the muhanai agentmesh data pipeline (PythiaConnector → LocalCrabAdapter → Fellowship)
 * with Trystero's WebRTC-based P2P transport. Replaces Gun.js relay as the signaling
 * layer and adds encrypted end-to-end event distribution.
 *
 * Integration strategy:
 *  - "p2pclaw" room: broadcasts Pythia events, forecasts, and impact analyses
 *  - "task-event" action: real-time agent task lifecycle (start/complete/status)
 *  - "event-feed" action: Pythia event stream (one-way messages)
 *  - "impact-alert" action: high-impact event notifications
 *  - File/action-based sync for model chunks (replaces IPFS for small payloads)
 */

import { REGION, TRYSTERO_APP_ID, TRYSTERO_STRATEGY, resolveNostrRelays } from "@/lib/config";
import { type ClientEvent, type Room, type SendOptions, joinRoom, selfId } from "trystero";

import type {
	ColibriMetrics,
	ImpactAnalysis,
	ModelChunkMetrics,
	PeerMetrics,
	PythiaEvent,
	PythiaForecast,
} from "@/types/pythia";

export interface TrysteroConfig {
	appId: string;
	strategy: TrysteroStrategy;
	password?: string;
	turnConfig?: RTCIceServer[];
	relayConfig?: { urls: string[]; supabaseKey?: string };
}

export type TrysteroStrategy =
	| "nostr"
	| "torrent"
	| "mqtt"
	| "supabase"
	| "firebase"
	| "ipfs"
	| "ws-relay";

const KNOWN_STRATEGIES = new Set<string>([
	"nostr",
	"mqtt",
	"supabase",
	"firebase",
	"ipfs",
	"ws-relay",
]);

const DEFAULT_CONFIG: TrysteroConfig = {
	appId: TRYSTERO_APP_ID,
	// Fall back to "nostr" if VITE_TRYSTERO_STRATEGY holds an unknown value;
	// trystero throws at join time otherwise.
	strategy: (KNOWN_STRATEGIES.has(TRYSTERO_STRATEGY)
		? TRYSTERO_STRATEGY
		: "nostr") as TrysteroStrategy,
	// Signaling relays come from config.ts: VITE_NOSTR_RELAYS when set, otherwise
	// NOSTR_RELAY_FALLBACKS — which deliberately omits bendernostur.duckdns.org:8443
	// (expired TLS certificate, 2026-10-05). A single expired relay in the list
	// stalls the whole WebRTC handshake and keeps the mesh silently offline.
	relayConfig: {
		urls: resolveNostrRelays(),
	},
};

export interface PeerInfo {
	id: string;
	joinedAt: number;
	region?: string;
	capabilities?: string[];
}

export interface ColibriGatewayInfo {
	baseUrl: string;
	model?: string;
	region?: string;
	peerId: string;
	timestamp: number;
	isPublic?: boolean;
}

export interface NetworkState {
	peerCount: number;
	peers: PeerInfo[];
	connections: number;
	lastHeartbeat: number;
	strategy: TrysteroStrategy;
	selfId: string;
}

export type PeerMessageHandler = (data: unknown, peerId: string) => void;
export type PeerJoinHandler = (peerId: string) => void;
export type PeerLeaveHandler = (peerId: string) => void;

/**
 * Wrapper around Trystero room management for the P2PCLAW data pipeline.
 *
 * Usage:
 *   const client = new TrysteroP2PClient();
 *   await client.join("main");
 *   client.subscribeToEvents(console.log);
 *   client.broadcastEvent(event);
 */
export class TrysteroP2PClient {
	private room: Room | null = null;
	private config: TrysteroConfig;
	private peers: Map<string, PeerInfo> = new Map();
	private handlers: {
		peerJoin: Set<PeerJoinHandler>;
		peerLeave: Set<PeerLeaveHandler>;
		event: Set<PeerMessageHandler>;
		forecast: Set<PeerMessageHandler>;
		impact: Set<PeerMessageHandler>;
		metrics: Set<PeerMessageHandler>;
		task: Set<PeerMessageHandler>;
		gateway: Set<PeerMessageHandler>;
		aiPackage: Set<PeerMessageHandler>;
	} = {
		peerJoin: new Set(),
		peerLeave: new Set(),
		event: new Set(),
		forecast: new Set(),
		impact: new Set(),
		metrics: new Set(),
		task: new Set(),
		gateway: new Set(),
		aiPackage: new Set(),
	};

	private colibriPeers: Map<string, ColibriGatewayInfo> = new Map();

	private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

	constructor(config: Partial<TrysteroConfig> = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	/**
	 * Join a Trystero room for the P2PCLAW network.
	 * Room ID follows the `{tenant}:{project}:{task}` isolation pattern from TRYSTERO_MUHANAI_INTEGRATION.md.
	 */
	async join(roomId: string): Promise<void> {
		if (this.room) this.leave();
		if (!roomId.trim()) throw new Error("Room ID cannot be empty");
		const trysteroConfig = this._buildTrysteroConfig();

		this.room = joinRoom(trysteroConfig, roomId);

		this.room.onPeerJoin = (peerId: string) => {
			this.peers.set(peerId, {
				id: peerId,
				joinedAt: Date.now(),
				region: REGION,
			});
			for (const handler of this.handlers.peerJoin) handler(peerId);
		};

		this.room.onPeerLeave = (peerId: string) => {
			this.peers.delete(peerId);
			for (const handler of this.handlers.peerLeave) handler(peerId);
		};

		this._setupActions();
		this._startHeartbeat();
	}

	leave(): void {
		if (this.room) {
			this.room.leave();
			this.room = null;
		}
		this.peers.clear();
		this.colibriPeers.clear();
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = null;
		}
	}

	getSelfId(): string {
		return selfId;
	}

	getNetworkState(): NetworkState {
		return {
			peerCount: this.peers.size,
			peers: Array.from(this.peers.values()),
			connections: this.peers.size,
			lastHeartbeat: Date.now(),
			strategy: this.config.strategy,
			selfId: selfId,
		};
	}

	onPeerJoin(handler: PeerJoinHandler): () => void {
		this.handlers.peerJoin.add(handler);
		return () => this.handlers.peerJoin.delete(handler);
	}

	onPeerLeave(handler: PeerLeaveHandler): () => void {
		this.handlers.peerLeave.add(handler);
		return () => this.handlers.peerLeave.delete(handler);
	}

	onPythiaEvent(handler: PeerMessageHandler): () => void {
		this.handlers.event.add(handler);
		return () => this.handlers.event.delete(handler);
	}

	onPythiaForecast(handler: PeerMessageHandler): () => void {
		this.handlers.forecast.add(handler);
		return () => this.handlers.forecast.delete(handler);
	}

	onImpactAlert(handler: PeerMessageHandler): () => void {
		this.handlers.impact.add(handler);
		return () => this.handlers.impact.delete(handler);
	}

	onMetrics(handler: PeerMessageHandler): () => void {
		this.handlers.metrics.add(handler);
		return () => this.handlers.metrics.delete(handler);
	}

	onTaskEvent(handler: PeerMessageHandler): () => void {
		this.handlers.task.add(handler);
		return () => this.handlers.task.delete(handler);
	}

	onColibriGateway(handler: PeerMessageHandler): () => void {
		this.handlers.gateway.add(handler);
		return () => this.handlers.gateway.delete(handler);
	}

	onAIPackage(handler: PeerMessageHandler): () => void {
		this.handlers.aiPackage.add(handler);
		return () => this.handlers.aiPackage.delete(handler);
	}

	broadcastAIPackage(pkg: unknown): void {
		this._sendAction("ai-package", pkg);
	}

	getColibriPeers(): Map<string, ColibriGatewayInfo> {
		return new Map(this.colibriPeers);
	}

	/**
	 * Broadcast a Pythia event to all peers in the room.
	 * Maps to the `event-feed` Trystero action.
	 */
	broadcastEvent(event: PythiaEvent, opts?: SendOptions): void {
		this._sendAction("event-feed", event, opts);
	}

	/**
	 * Broadcast a Pythia forecast to all peers.
	 * Maps to the `forecast-update` Trystero action.
	 */
	broadcastForecast(forecast: PythiaForecast, opts?: SendOptions): void {
		this._sendAction("forecast-update", forecast, opts);
	}

	/**
	 * Broadcast an impact analysis to all peers.
	 * Maps to the `impact-alert` Trystero action.
	 */
	broadcastImpact(impact: ImpactAnalysis, opts?: SendOptions): void {
		this._sendAction("impact-alert", impact, opts);
	}

	/**
	 * Broadcast Colibri metrics (model performance, peer stats, chunk metrics).
	 * Maps to the `metrics-broadcast` Trystero action.
	 */
	broadcastMetrics(
		metrics: {
			colibri: ColibriMetrics;
			peers: PeerMetrics[];
			chunks: ModelChunkMetrics;
		},
		opts?: SendOptions,
	): void {
		this._sendAction("metrics-broadcast", metrics, opts);
	}

	/**
	 * Broadcast Colibri gateway info so peers can discover P2P inference endpoints.
	 * Maps to the `colibri-gateway` Trystero action.
	 * This bridges Trystero P2P discovery with the inference-router's colibri_p2p adapter.
	 */
	broadcastColibriGateway(info: ColibriGatewayInfo, opts?: SendOptions): void {
		this._sendAction("colibri-gateway", info, opts);
	}

	/**
	 * Send a task-event action (start/complete/status) to specific peers or all.
	 */
	async sendTaskEvent(
		eventType: string,
		payload: Record<string, unknown>,
		opts?: SendOptions,
	): Promise<unknown> {
		const data = {
			schemaVersion: "1.0.0",
			eventType,
			timestamp: Date.now(),
			eventId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
			...payload,
		};
		this._sendAction("task-event", data, opts);
		return data;
	}

	/**
	 * Request-response action for peer capability queries.
	 * Maps to the `peer-query` Trystero request action.
	 */
	async requestPeerCapabilities(peerId: string, timeoutMs = 5000): Promise<unknown> {
		if (!this.room) {
			throw new Error("Not joined to a room");
		}
		const query = this.room.makeAction("peer-query", {
			kind: "request",
			onRequest: () => {
				return {
					peerId: selfId,
					models: [],
					region: REGION,
					timestamp: Date.now(),
				};
			},
		});

		return query.request(null, { target: peerId, timeoutMs });
	}

	/**
	 * Ping a specific peer and return round-trip time in milliseconds.
	 */
	async ping(peerId: string, timeoutMs = 3000): Promise<number> {
		if (!this.room) {
			throw new Error("Not joined to a room");
		}

		const ping = this.room.makeAction("ping-pong", {
			kind: "request",
			onRequest: () => Date.now(),
		});

		const start = Date.now();
		try {
			await ping.request(start, { target: peerId, timeoutMs });
			return Date.now() - start;
		} catch {
			return -1;
		}
	}

	private _buildTrysteroConfig(): TrysteroConfig {
		const cfg: TrysteroConfig = {
			appId: this.config.appId,
			strategy: this.config.strategy,
		};
		if (this.config.password) cfg.password = this.config.password;
		if (this.config.turnConfig) cfg.turnConfig = this.config.turnConfig;
		if (this.config.relayConfig) cfg.relayConfig = this.config.relayConfig;
		return cfg;
	}

	private _setupActions(): void {
		if (!this.room) return;

		const eventFeed = this.room.makeAction("event-feed");
		eventFeed.onMessage = (data: unknown, { peerId }: { peerId: string }) => {
			for (const handler of this.handlers.event) handler(data, peerId);
		};

		const forecastUpdate = this.room.makeAction("forecast-update");
		forecastUpdate.onMessage = (data: unknown, { peerId }: { peerId: string }) => {
			for (const handler of this.handlers.forecast) handler(data, peerId);
		};

		const impactAlert = this.room.makeAction("impact-alert");
		impactAlert.onMessage = (data: unknown, { peerId }: { peerId: string }) => {
			for (const handler of this.handlers.impact) handler(data, peerId);
		};

		const metricsBroadcast = this.room.makeAction("metrics-broadcast");
		metricsBroadcast.onMessage = (data: unknown, { peerId }: { peerId: string }) => {
			for (const handler of this.handlers.metrics) handler(data, peerId);
		};

		const taskEvent = this.room.makeAction("task-event");
		taskEvent.onMessage = (data: unknown, { peerId }: { peerId: string }) => {
			for (const handler of this.handlers.task) handler(data, peerId);
		};

		const gateway = this.room.makeAction("colibri-gateway");
		gateway.onMessage = (data: unknown, { peerId }: { peerId: string }) => {
			const info = data as ColibriGatewayInfo;
			this.colibriPeers.set(peerId, { ...info, peerId, timestamp: Date.now() });
			for (const handler of this.handlers.gateway) handler(data, peerId);
		};

		const aiPackage = this.room.makeAction("ai-package");
		aiPackage.onMessage = (data: unknown, { peerId }: { peerId: string }) => {
			for (const handler of this.handlers.aiPackage) handler(data, peerId);
		};
		}

	private _sendAction(actionId: string, data: unknown, opts?: SendOptions): void {
		if (!this.room) {
			console.warn("Not joined to a room, dropping message:", actionId);
			return;
		}
		const action = this.room.makeAction(actionId);
		action.send(data, opts);
	}

	private _startHeartbeat(): void {
		this.heartbeatTimer = setInterval(() => {
			if (this.room) {
				const heartbeat = this.room.makeAction("heartbeat");
				heartbeat.send({
					peerId: selfId,
					ts: Date.now(),
					peers: this.getNetworkState(),
				});
			}
		}, 10000);
	}
}

export { selfId, joinRoom };
export type { Room, SendOptions, ClientEvent };
