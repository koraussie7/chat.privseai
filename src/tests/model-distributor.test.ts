import { describe, it, expect, beforeEach } from "vitest";
import { ModelDistributor, CHUNK_SIZE } from "@/lib/model-distributor";
import type { ModelManifest, P2PModelInfo } from "@/lib/model-distributor";

describe("ModelDistributor", () => {
	let distributor: ModelDistributor;

	beforeEach(() => {
		distributor = new ModelDistributor();
	});

	it("initializes with empty state", async () => {
		expect(await distributor.getAvailableModels()).toEqual([]);
	});

	it("returns null for unknown model CID", async () => {
		const result = await distributor.findModel("unknown-cid-123");
		expect(result).toBeNull();
	});

	it("returns chunk size constant", () => {
		expect(CHUNK_SIZE).toBe(256 * 1024 * 1024);
	});

	it("clears cache on clearCache()", () => {
		distributor.clearCache();
	});

	it("handles model manifest structure", () => {
		const manifest: ModelManifest = {
			modelCid: "test-cid",
			name: "test-model",
			quantization: "Q4_K_M",
			fileSize: 1024,
			chunkSize: 512,
			totalChunks: 2,
			chunks: [
				{ index: 0, checksum: "abc123", size: 512 },
				{ index: 1, checksum: "def456", size: 512 },
			],
		};
		expect(manifest.totalChunks).toBe(2);
		expect(manifest.chunks.length).toBe(2);
	});

	it("handles P2P model info structure", () => {
		const info: P2PModelInfo = {
			modelCid: "test-cid",
			peerId: "peer-001",
			totalChunks: 4,
			fullModel: true,
			latency: 42,
		};
		expect(info.fullModel).toBe(true);
		expect(info.latency).toBe(42);
	});
});
