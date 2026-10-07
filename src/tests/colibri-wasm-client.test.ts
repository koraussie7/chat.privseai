import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ColibriWASMClient } from "@/lib/colibri-wasm-client";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockModel = {
  cid: "bafyreibglm52",
  name: "GLM-5.2 744B",
  size: 372000000000,
  quantization: "int4",
  chunks: 1488,
  registeredAt: Date.now(),
};

const mockGenerateResult = {
  provider: "fellowship-colibri-wasm",
  model: "GLM-5.2 744B",
  object: "chat.completion",
  choices: [
    {
      index: 0,
      message: { role: "assistant", content: "Hello from Colibri WASM!" },
      finish_reason: "stop",
    },
  ],
  usage: { prompt_tokens: 12, completion_tokens: 20, total_tokens: 32 },
  p2p: {
    servedBy: "fellowship-node-1",
    modelCid: "bafyreibglm52",
    chunksServed: 1488,
  },
};

const mockStatus = {
  loaded: true,
  nativeLoaded: false,
  memoryUsed: 128,
  memoryTotal: 256,
  threads: 4,
  modelLoaded: "GLM-5.2 744B",
  modelsAvailable: 2,
};

const mockNetworkState = [
  {
    id: "fellowship-node-1",
    type: "fellowship",
    status: "online",
    region: "global",
    model: "GLM-5.2 744B",
    uptime: "active",
    wasmLoaded: true,
    nativeLoaded: false,
  },
];

describe("ColibriWASMClient", () => {
  let client: ColibriWASMClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new ColibriWASMClient("http://localhost:3001");
  });

  describe("constructor", () => {
    it("uses provided base URL", () => {
      expect(client.getBaseUrl()).toBe("http://localhost:3001");
    });

    it("strips trailing slash from base URL", () => {
      const c = new ColibriWASMClient("http://localhost:3001/");
      expect(c.getBaseUrl()).toBe("http://localhost:3001");
    });

    it("uses default URL when not provided", () => {
      const c = new ColibriWASMClient();
      expect(c.getBaseUrl()).toBe("http://localhost:3001");
    });
  });

  describe("generate", () => {
    it("sends POST request to /api/colibri/generate with correct payload", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockGenerateResult,
      });

      const result = await client.generate("bafyreibglm52", "Hello, world!");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/colibri/generate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modelCid: "bafyreibglm52",
            prompt: "Hello, world!",
            maxTokens: 512,
            temperature: 0.7,
            topP: 0.9,
            topK: 40,
            seed: 42,
          }),
        },
      );
      expect(result).toEqual(mockGenerateResult);
    });

    it("passes custom generation options", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockGenerateResult,
      });

      await client.generate("bafyreibglm52", "Test", {
        maxTokens: 100,
        temperature: 0.1,
        topP: 0.5,
        topK: 10,
        seed: 99,
      });

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call?.[1]?.body ?? "{}");
      expect(body.maxTokens).toBe(100);
      expect(body.temperature).toBe(0.1);
      expect(body.topP).toBe(0.5);
      expect(body.topK).toBe(10);
      expect(body.seed).toBe(99);
    });

    it("throws on non-OK response", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(client.generate("cid", "prompt")).rejects.toThrow(
        "Colibri generate failed: 500",
      );
    });
  });

  describe("registerModel", () => {
    it("registers a model and returns true", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ registered: true, cid: mockModel.cid }),
      });

      const result = await client.registerModel(
        mockModel.cid,
        mockModel.name,
        mockModel.size,
        mockModel.quantization,
      );

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/models/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cid: mockModel.cid,
            name: mockModel.name,
            size: mockModel.size,
            quantization: mockModel.quantization,
          }),
        },
      );
    });

    it("throws on registration failure", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });

      await expect(
        client.registerModel("cid", "name", 100, "int4"),
      ).rejects.toThrow("Model registration failed: 400");
    });

    it("caches model info locally after registration", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ registered: true, cid: mockModel.cid }),
      });

      await client.registerModel(
        mockModel.cid,
        mockModel.name,
        mockModel.size,
        mockModel.quantization,
      );

      const models = client.getModels();
      expect(models.has(mockModel.cid)).toBe(true);
      const stored = models.get(mockModel.cid);
      expect(stored?.name).toBe(mockModel.name);
      expect(stored?.chunks).toBe(Math.ceil(mockModel.size / (256 * 1024 * 1024)));
    });
  });

  describe("listModels", () => {
    it("fetches and caches models from /api/models", async () => {
      const mockModels = [mockModel];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockModels,
      });

      const result = await client.listModels();

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/models",
      );
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe(mockModel.name);
    });

    it("throws on fetch failure", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });

      await expect(client.listModels()).rejects.toThrow("Failed to list models: 503");
    });
  });

  describe("getStatus", () => {
    it("fetches Colibri engine status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus,
      });

      const status = await client.getStatus();

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/colibri/status",
      );
      expect(status).toEqual(mockStatus);
      expect(status.loaded).toBe(true);
    });

    it("returns wasmLoaded and nativeLoaded fields", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus,
      });

      const status = await client.getStatus();
      expect(typeof status.loaded).toBe("boolean");
      expect(typeof status.nativeLoaded).toBe("boolean");
    });
  });

  describe("getNetworkState", () => {
    it("fetches P2P network state from Fellowship", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockNetworkState,
      });

      const peers = await client.getNetworkState();

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/network/p2pclaw",
      );
      expect(peers).toHaveLength(1);
      expect(peers[0]?.type).toBe("fellowship");
      expect(peers[0]?.wasmLoaded).toBe(true);
    });
  });

  describe("syncMemory", () => {
    it("POSTs to /api/memory/sync with correct payload", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ synced: true, agentId: "test", key: "memory" }),
      });

      const result = await client.syncMemory({
        agentId: "test-agent",
        key: "context",
        value: { foo: "bar" },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/memory/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: "test-agent",
            key: "context",
            value: { foo: "bar" },
          }),
        },
      );
      expect(result).toBe(true);
    });

    it("throws on sync failure", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(
        client.syncMemory({ agentId: "x", key: "y", value: "z" }),
      ).rejects.toThrow("Memory sync failed: 500");
    });
  });

  describe("collectMetrics", () => {
    it("returns ColibriMetrics-compatible object", () => {
      const metrics = client.collectMetrics();

      expect(metrics).toMatchObject({
        modelName: "none",
        vocabSize: 0,
        hiddenSize: 0,
        numLayers: 0,
        numHeads: 0,
        headDim: 0,
        maxSeqLen: 0,
        timestamp: expect.any(Number),
      });
    });

    it("includes registered model name in metrics", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ ...mockModel, registeredAt: Date.now() }],
      });

      await client.listModels();
      const metrics = client.collectMetrics();
      expect(metrics.modelName).toBe(mockModel.name);
    });
  });
});
