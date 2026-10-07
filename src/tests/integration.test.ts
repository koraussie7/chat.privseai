import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TrysteroP2PClient } from "@/lib/trystero-client";
import { ColibriWASMClient } from "@/lib/colibri-wasm-client";
import { joinRoom, mockRoom } from "@/mocks/trystero-mock";
import type { PythiaEvent, ImpactAnalysis } from "@/types/pythia";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockEvent: PythiaEvent = {
  event_id: "evt-int-001",
  source_agent: "pythia-agent-7",
  source_run: "run-abc",
  timestamp: new Date().toISOString(),
  kind: "model_benchmark",
  severity: "info",
  title: "GLM-5.2 benchmark complete",
  body: "Completed benchmark: 1250 tokens/sec, 98.5% acceptance",
  metadata: {
    model: "GLM-5.2 744B",
    tokens_per_second: 1250,
    acceptance_rate: 0.985,
  },
  cid: "bafyreibglm52",
  schema_version: "1.0.0",
};

const mockImpact: ImpactAnalysis = {
  target_id: "evt-int-001",
  target_type: "event",
  tier: "high",
  score: 0.82,
  affected_agents: ["pythia-agent-7", "fellowship-node-1"],
  affected_domains: ["research", "compute"],
  rationale: "GLM-5.2 performance exceeds threshold for P2P model serving",
  mitigations: ["Monitor token throughput", "Validate against quorum peers"],
  generated_by: "impact-analyzer-v2",
  generated_at: new Date().toISOString(),
  colibri_metrics_ref: "colibri-metrics-evt-int-001",
};

describe("Integration: Trystero P2P + Colibri WASM pipeline", () => {
  let p2p: TrysteroP2PClient;
  let colibri: ColibriWASMClient;

  beforeEach(() => {
    mockRoom._reset();
    mockFetch.mockReset();
    p2p = new TrysteroP2PClient({ appId: "privseai-integration-test" });
    colibri = new ColibriWASMClient("http://localhost:3001");
  });

  afterEach(() => {
    p2p.leave();
  });

  it("full pipeline: join room → generate inference → broadcast event + impact", async () => {
    await p2p.join("p2pclaw:integration-test");

    p2p.onPythiaEvent(() => {});
    p2p.onImpactAlert(() => {});

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        provider: "fellowship-colibri-wasm",
        model: "GLM-5.2 744B",
        object: "chat.completion",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "Benchmark results confirm exceptional performance.",
            },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 50, completion_tokens: 45, total_tokens: 95 },
        p2p: {
          servedBy: "fellowship-node-1",
          modelCid: "bafyreibglm52",
          chunksServed: 1488,
        },
      }),
    });

    const generateResult = await colibri.generate(mockEvent.cid!, mockEvent.body);

    expect(generateResult.choices[0]?.message.content).toContain(
      "exceptional performance",
    );
    expect(generateResult.p2p?.servedBy).toBe("fellowship-node-1");

    p2p.broadcastEvent(mockEvent);
    expect(mockRoom.makeAction).toHaveBeenCalledWith("event-feed");

    p2p.broadcastImpact(mockImpact);
    expect(mockRoom.makeAction).toHaveBeenCalledWith("impact-alert");

    expect(p2p.getNetworkState()).toMatchObject({
      peerCount: 0,
      strategy: "nostr",
      selfId: "test-peer-12345",
    });
  });

  it("network state reflects peer join/leave events", async () => {
    await p2p.join("p2pclaw:integration-test");

    const joinHandler = mockRoom.onPeerJoin as (id: string) => void;
    joinHandler("peer-a");
    joinHandler("peer-b");

    const state1 = p2p.getNetworkState();
    expect(state1.peerCount).toBe(2);
    expect(state1.peers).toHaveLength(2);

    const leaveHandler = mockRoom.onPeerLeave as (id: string) => void;
    leaveHandler("peer-a");

    const state2 = p2p.getNetworkState();
    expect(state2.peerCount).toBe(1);
  });

  it("model registration and WASM inference work via Fellowship API", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ registered: true, cid: mockEvent.cid }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { cid: mockEvent.cid, name: "GLM-5.2 744B", size: 372000000000, quantization: "int4", chunks: 1488, registeredAt: Date.now() },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          provider: "fellowship-colibri-wasm",
          model: "GLM-5.2 744B",
          object: "chat.completion",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "P2P inference result" },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          p2p: { servedBy: "fellowship-node-1" },
        }),
      });

    await colibri.registerModel(mockEvent.cid!, "GLM-5.2 744B", 372_000_000_000, "int4");

    const models = await colibri.listModels();
    expect(models).toHaveLength(1);

    const result = await colibri.generate(mockEvent.cid!, "test prompt");
    expect(result.provider).toBe("fellowship-colibri-wasm");
    expect(result.choices[0]?.message.content).toBe("P2P inference result");
  });

  it("task event broadcast includes schema version and event ID", async () => {
    await p2p.join("p2pclaw:integration-test");

    const taskResult = await p2p.sendTaskEvent("task-start", {
      taskId: "task-001",
      modelId: "GLM-5.2",
    });

    expect(taskResult).toMatchObject({
      schemaVersion: "1.0.0",
      eventType: "task-start",
      eventId: expect.stringMatching(/^[\d-]+-[a-z0-9]+$/),
      taskId: "task-001",
      modelId: "GLM-5.2",
    });

    expect(mockRoom.makeAction).toHaveBeenCalledWith("task-event");
  });

  it("Colibri status and network state are fetched correctly", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          loaded: true,
          nativeLoaded: false,
          memoryUsed: 256,
          memoryTotal: 512,
          threads: 4,
          modelLoaded: "GLM-5.2 744B",
          modelsAvailable: 2,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
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
        ],
      });

    const status = await colibri.getStatus();
    expect(status.loaded).toBe(true);
    expect(status.memoryUsed).toBe(256);

    const networkPeers = await colibri.getNetworkState();
    expect(networkPeers).toHaveLength(1);
    expect(networkPeers[0]?.type).toBe("fellowship");
    expect(networkPeers[0]?.wasmLoaded).toBe(true);
  });

  it("memory sync endpoint accepts Pythia event data", async () => {
    const syncPayload = {
      agentId: "agent-1",
      key: "event-buffer",
      value: mockEvent,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ synced: true, agentId: "agent-1", key: "event-buffer" }),
    });

    const result = await colibri.syncMemory(syncPayload);
    expect(result).toBe(true);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/memory/sync",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(syncPayload),
      }),
    );
  });
});
