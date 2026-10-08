/**
 * P2P Model Distributor for privseai.com
 *
 * Distributes model chunks via Trystero WebRTC P2P mesh.
 * Falls back to Fellowship gateway when no peers have the model.
 * Integrates with Colibri WASM for local browser inference.
 *
 * This is the backbone of the "free P2P adult AI chat" — models
 * are served by peers, not centralized servers.
 */

import { type ColibriGatewayInfo, type TrysteroP2PClient } from "@/lib/trystero-client";
import type { ColibriModelInfo } from "@/lib/colibri-wasm-client";

export interface ModelChunk {
	cid: string;
	index: number;
	total: number;
	data: Uint8Array;
	checksum: string;
}

export interface ModelManifest {
	modelCid: string;
	name: string;
	quantization: string;
	fileSize: number;
	chunkSize: number;
	totalChunks: number;
	chunks: { index: number; checksum: string; size: number }[];
	source?: "p2p" | "fellowship" | "local";
}

export interface P2PModelInfo {
	modelCid: string;
	peerId: string;
	availableChunks?: number[];
	totalChunks: number;
	fullModel: boolean;
	latency: number;
}

const CHUNK_SIZE = 256 * 1024 * 1024;

export class ModelDistributor {
	private client: TrysteroP2PClient | null = null;
	private peerModels = new Map<string, P2PModelInfo>();
	private colibriPeers: Map<string, ColibriGatewayInfo> = new Map();
	private localCache = new Map<string, ModelManifest>();

	constructor() {}

	setClient(client: TrysteroP2PClient): void {
		this.client = client;

		client.onColibriGateway((data, peerId) => {
			const info = data as ColibriGatewayInfo;
			if (info.model) {
				this.peerModels.set(info.peerId ?? peerId, {
					modelCid: info.model,
					peerId: info.peerId ?? peerId,
					totalChunks: 0,
					fullModel: false,
					latency: 50,
				});
				this.colibriPeers.set(peerId, info);
			}
		});
	}

	async findModel(modelCid: string): Promise<P2PModelInfo | null> {
		const peers = Array.from(this.peerModels.values()).filter(
			(p) => p.modelCid === modelCid,
		);

		if (peers.length === 0) {
			const colibriPeers = Array.from(this.colibriPeers.values());
			for (const ep of colibriPeers) {
				if (ep.model && ep.model.includes(modelCid)) {
					return {
						modelCid,
						peerId: ep.peerId,
						totalChunks: 1,
						fullModel: true,
						latency: 50,
					};
				}
			}
		}

		return (
			peers.sort((a, b) => a.latency - b.latency)[0] ?? null
		);
	}

	async downloadModel(modelCid: string): Promise<{ manifest: ModelManifest; data: Blob } | null> {
		const cached = this.localCache.get(modelCid);
		if (cached) {
			return { manifest: cached, data: new Blob() };
		}

		const peer = await this.findModel(modelCid);

		if (peer) {
			return this.downloadFromPeer(modelCid, peer.peerId);
		}

		const fellowshipPeer = Array.from(this.colibriPeers.values())[0];
		if (fellowshipPeer) {
			return this.downloadFromFellowship(modelCid, fellowshipPeer);
		}

		return null;
	}

	private async downloadFromPeer(
		modelCid: string,
		peerId: string,
	): Promise<{ manifest: ModelManifest; data: Blob } | null> {
		const chunks: Uint8Array[] = [];
		let manifest: ModelManifest | null = null;

		const action = this.client?.["room"]?.makeAction("model-chunk-request");
		if (!action) return null;

		const requestChunk = async (index: number): Promise<Uint8Array | null> => {
			const response = await action.request({ modelCid, chunkIndex: index }, { target: peerId, timeoutMs: 30000 });
			if (response && typeof response === "object" && "data" in response) {
				return new Uint8Array(response.data as ArrayBuffer);
			}
			return null;
		};

		const manifestResponse = await action.request({ modelCid, getManifest: true }, { target: peerId, timeoutMs: 15000 });
		if (manifestResponse && typeof manifestResponse === "object" && "manifest" in manifestResponse) {
			manifest = manifestResponse.manifest as ModelManifest;
		}

		if (!manifest) return null;

		const total = manifest.totalChunks;
		const concurrency = 4;
		const results: (Uint8Array | null)[] = new Array(total);

		for (let i = 0; i < total; i += concurrency) {
			const batch = [];
			for (let j = i; j < Math.min(i + concurrency, total); j++) {
				batch.push(requestChunk(j).then((r) => (results[j] = r)));
			}
			await Promise.all(batch);
		}

		for (let i = 0; i < total; i++) {
			if (results[i]) {
				chunks.push(results[i]!);
			}
		}

		if (chunks.length < total) {
			console.warn(`Only downloaded ${chunks.length}/${total} chunks from peer ${peerId}`);
		}

		const blob = new Blob(chunks.map((c) => c.slice().buffer as ArrayBuffer));
		this.localCache.set(modelCid, manifest);

		return { manifest, data: blob };
	}

	private async downloadFromFellowship(
		modelCid: string,
		peer: ColibriGatewayInfo,
	): Promise<{ manifest: ModelManifest; data: Blob } | null> {
		try {
			const manifestRes = await fetch(`${peer.baseUrl}/api/models/${modelCid}`);
			if (!manifestRes.ok) return null;

			const manifest: ModelManifest = await manifestRes.json();

			const chunkRes = await fetch(`${peer.baseUrl}/api/models/${modelCid}/download`);
			if (!chunkRes.ok) return null;

			const blob = await chunkRes.blob();
			this.localCache.set(modelCid, manifest);

			return { manifest, data: blob };
		} catch (err) {
			console.error(`Fellowship download failed for ${modelCid}:`, err);
			return null;
		}
	}

	async getAvailableModels(): Promise<ColibriModelInfo[]> {
		const models: ColibriModelInfo[] = [];

		for (const info of this.peerModels.values()) {
			models.push({
				cid: info.modelCid,
				name: info.modelCid.substring(0, 12),
				size: 0,
				quantization: "unknown",
				chunks: info.totalChunks,
				registeredAt: 0,
			});
		}

		return models;
	}

	clearCache(): void {
		this.localCache.clear();
		this.peerModels.clear();
	}
}

export { CHUNK_SIZE };
