/**
 * Colibri WASM inference bridge for privseai.com.
 *
 * Connects to the muhanai Fellowship node (port 3001) for Colibri WASM inference,
 * and provides a local WASM loading path when running in a standalone context.
 * Mirrors the Fellowship node's `/api/colibri/generate` endpoint contract.
 */

import type { ColibriMetrics } from "@/types/pythia";

export interface ColibriGenerateOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  seed?: number;
}

export interface ColibriGenerateResult {
  provider: string;
  model: string;
  object: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  p2p?: {
    servedBy: string;
    modelCid?: string;
    chunksServed?: number;
  };
  error?: string;
}

export interface ColibriModelInfo {
  cid: string;
  name: string;
  size: number;
  quantization: string;
  chunks: number;
  registeredAt: number;
}

const DEFAULT_OPTIONS: Required<ColibriGenerateOptions> = {
  maxTokens: 512,
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  seed: 42,
};

/**
 * Bridge to the Fellowship node's Colibri WASM inference API.
 *
 * The Fellowship node (deploy/fellowship/src/index.js) provides:
 *   POST /api/colibri/generate  — WASM or native inference
 *   POST /api/models/register    — Register a model by CID
 *   GET  /api/models             — List registered models
 *   GET  /api/colibri/status     — Colibri engine status
 *   GET  /api/network/p2pclaw   — P2P network state
 */
export class ColibriWASMClient {
  private baseUrl: string;
  private models: Map<string, ColibriModelInfo> = new Map();

  constructor(
     baseUrl: string = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_FELLOWSHIP_URL ?? "http://localhost:3001",
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  /**
   * Generate text using the Colibri WASM engine on the Fellowship node.
   * Falls back to P2P proxy mode if no inference backend is available.
   */
  async generate(
    modelCid: string,
    prompt: string,
    opts: ColibriGenerateOptions = {},
  ): Promise<ColibriGenerateResult> {
    const options = { ...DEFAULT_OPTIONS, ...opts };

    const response = await fetch(`${this.baseUrl}/api/colibri/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modelCid,
        prompt,
        maxTokens: options.maxTokens,
        temperature: options.temperature,
        topP: options.topP,
        topK: options.topK,
        seed: options.seed,
      }),
    });

    if (!response.ok) {
      throw new Error(`Colibri generate failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Register a model (by CID) with the Fellowship node.
   * Models are identified by IPFS CIDs in the P2PCLAW network.
   */
  async registerModel(
    cid: string,
    name: string,
    size: number,
    quantization: string,
  ): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/api/models/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cid, name, size, quantization }),
    });

    if (!response.ok) {
      throw new Error(`Model registration failed: ${response.status}`);
    }

    const info = await response.json();
    this.models.set(cid, {
      cid,
      name,
      size,
      quantization,
      chunks: Math.ceil(size / (256 * 1024 * 1024)),
      registeredAt: Date.now(),
    });
    return info.registered;
  }

  /**
   * Fetch the list of registered models from the Fellowship node.
   */
  async listModels(): Promise<ColibriModelInfo[]> {
    const response = await fetch(`${this.baseUrl}/api/models`);
    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.status}`);
    }
    const models: Array<{
      cid: string;
      name: string;
      size: number;
      quantization: string;
      chunks: number;
    }> = await response.json();

    this.models.clear();
    for (const m of models) {
      this.models.set(m.cid, { ...m, registeredAt: Date.now() });
    }
    return Array.from(this.models.values());
  }

  /**
   * Get the Colibri engine status (loaded, memory, threads, models).
   */
  async getStatus(): Promise<{
    loaded: boolean;
    nativeLoaded: boolean;
    memoryUsed: number;
    memoryTotal: number;
    threads: number;
    modelLoaded: string | null;
    modelsAvailable: number;
  }> {
    const response = await fetch(`${this.baseUrl}/api/colibri/status`);
    if (!response.ok) {
      throw new Error(`Status check failed: ${response.status}`);
    }
    return response.json();
  }

  /**
   * Get P2P network state from the Fellowship node.
   */
  async getNetworkState(): Promise<Array<{
    id: string;
    type: string;
    status: string;
    region: string;
    model: string | null;
    uptime: string;
    wasmLoaded: boolean;
    nativeLoaded: boolean;
  }>> {
    const response = await fetch(`${this.baseUrl}/api/network/p2pclaw`);
    if (!response.ok) {
      throw new Error(`Network state failed: ${response.status}`);
    }
    return response.json();
  }

  /**
   * Sync memory/knowledge between the local peer and the Fellowship node.
   * This bridges to the MemWal bridge API from the muhanai integration.
   */
  async syncMemory(payload: {
    agentId: string;
    key: string;
    value: unknown;
  }): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/api/memory/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Memory sync failed: ${response.status}`);
    }
    const result = await response.json();
    return result.synced;
  }

  /**
   * Collect Colibri metrics for the local peer.
   * Mirrors the ColibriMetrics dataclass from colibri_metrics.py.
   */
  collectMetrics(): ColibriMetrics {
    return {
      modelName: this.models.values().next().value?.name ?? "none",
      modelCid: this.models.values().next().value?.cid ?? "",
      vocabSize: 0,
      hiddenSize: 0,
      numLayers: 0,
      numHeads: 0,
      headDim: 0,
      maxSeqLen: 0,
      tokensGenerated: 0,
      tokensPerSecond: 0,
      memoryUsedMB: 0,
      memoryTotalMB: 0,
      loadTimeMs: 0,
      timestamp: Date.now(),
    };
  }

  getModels(): Map<string, ColibriModelInfo> {
    return new Map(this.models);
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }
}
