import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TrysteroP2PClient } from "@/lib/trystero-client";
import { joinRoom, mockRoom, selfId } from "@/mocks/trystero-mock";
import type { PythiaEvent, PythiaForecast, ImpactAnalysis } from "@/types/pythia";
import type { TrysteroStrategy } from "@/lib/trystero-client";

const mockEvent: PythiaEvent = {
  event_id: "evt-001",
  source_agent: "test-agent",
  source_run: "run-1",
  timestamp: new Date().toISOString(),
  kind: "system_event",
  severity: "info",
  title: "Test Event",
  body: "This is a test event body",
  metadata: { key: "value" },
  cid: "bafy123",
  schema_version: "1.0.0",
};

const mockForecast: PythiaForecast = {
  forecast_id: "fc-001",
  agent_id: "test-agent",
  created_at: new Date().toISOString(),
  resolved_at: null,
  hypothesis: "Test hypothesis",
  outcome: "Test outcome",
  confidence: "medium",
  confidence_numeric: 0.55,
  horizon: "7 days",
  window_start: null,
  window_end: null,
  supporting_events: ["evt-001"],
  citations: [],
  localcrab_claim_id: null,
};

const mockImpact: ImpactAnalysis = {
  target_id: "evt-001",
  target_type: "event",
  tier: "medium",
  score: 0.65,
  affected_agents: ["agent-a", "agent-b"],
  affected_domains: ["security", "compliance"],
  rationale: "Event may affect security posture",
  mitigations: ["review access controls"],
  generated_by: "impact-analyzer-v2",
  generated_at: new Date().toISOString(),
  colibri_metrics_ref: null,
};

describe("TrysteroP2PClient", () => {
  let client: TrysteroP2PClient;

  beforeEach(() => {
    mockRoom._reset();
    client = new TrysteroP2PClient({
      appId: "test-app",
      strategy: "ws-relay" as TrysteroStrategy,
      relayConfig: { urls: ["wss://test.relay"] },
    });
  });

  afterEach(() => {
    client.leave();
  });

  it("creates client with default config", () => {
    const defaultClient = new TrysteroP2PClient();
    expect(defaultClient).toBeDefined();
  });

  it("joinRoom calls trystero joinRoom with correct config", async () => {
    await client.join("test-room");

    expect(joinRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: "test-app",
        relayConfig: { urls: ["wss://test.relay"] },
      }),
      "test-room",
    );
  });

  it("tracks peer join and leave events", async () => {
    await client.join("test-room");

    const onPeerJoin = vi.fn();
    const unsub = client.onPeerJoin(onPeerJoin);

    expect(mockRoom.onPeerJoin).toBeInstanceOf(Function);
    const joinHandler = mockRoom.onPeerJoin as (id: string) => void;
    joinHandler("peer-new-123");

    expect(onPeerJoin).toHaveBeenCalledWith("peer-new-123");
    unsub();
  });

  it("unsubscribes peer join handler correctly", async () => {
    await client.join("test-room");

    const handler = vi.fn();
    const unsub = client.onPeerJoin(handler);
    unsub();

    const joinHandler = mockRoom.onPeerJoin as (id: string) => void;
    joinHandler("peer-new-456");

    expect(handler).not.toHaveBeenCalled();
  });

  it("broadcastEvent sends data via event-feed action", async () => {
    await client.join("test-room");
    client.broadcastEvent(mockEvent);

    expect(mockRoom.makeAction).toHaveBeenCalledWith("event-feed");
    const action = mockRoom._actions.get("event-feed") as any;
    expect(action?.send).toHaveBeenCalledWith(mockEvent, undefined);
  });

  it("broadcastForecast sends data via forecast-update action", async () => {
    await client.join("test-room");
    client.broadcastForecast(mockForecast);

    expect(mockRoom.makeAction).toHaveBeenCalledWith("forecast-update");
  });

  it("broadcastImpact sends data via impact-alert action", async () => {
    await client.join("test-room");
    client.broadcastImpact(mockImpact);

    expect(mockRoom.makeAction).toHaveBeenCalledWith("impact-alert");
  });

  it("getNetworkState returns correct structure", async () => {
    await client.join("test-room");

    const state = client.getNetworkState();

    expect(state).toMatchObject({
      peerCount: 0,
      peers: [],
      connections: 0,
      strategy: "ws-relay",
      selfId: "test-peer-12345",
    });
    expect(state.lastHeartbeat).toBeGreaterThan(0);
  });

  it("leave calls room.leave and clears peers", async () => {
    await client.join("test-room");
    client.leave();

    expect(mockRoom.leave).toHaveBeenCalled();
    expect(client.getNetworkState().peerCount).toBe(0);
  });

  it("sets up all required action listeners on join", async () => {
    await client.join("test-room");

    const actionCalls = mockRoom.makeAction.mock.calls;
    expect(actionCalls).toContainEqual(["event-feed"]);
    expect(actionCalls).toContainEqual(["forecast-update"]);
    expect(actionCalls).toContainEqual(["impact-alert"]);
    expect(actionCalls).toContainEqual(["metrics-broadcast"]);
    expect(actionCalls).toContainEqual(["task-event"]);
    expect(actionCalls).toContainEqual(["colibri-gateway"]);
  });

  it("sendTaskEvent creates structured task event payload", async () => {
    await client.join("test-room");
    const payload = { action: "test", data: "value" };
    const result = await client.sendTaskEvent("task-start", payload);

    expect(result).toMatchObject({
      schemaVersion: "1.0.0",
      eventType: "task-start",
      timestamp: expect.any(Number),
      eventId: expect.any(String),
      action: "test",
    });
  });

  it("broadcastColibriGateway sends gateway info via colibri-gateway action", async () => {
    await client.join("test-room");

    const gatewayInfo = {
      baseUrl: "https://colibri-peer.example.com/v1",
      model: "GLM-5.2 744B",
      region: "us-east",
      peerId: "peer-xyz",
      timestamp: Date.now(),
    };

    client.broadcastColibriGateway(gatewayInfo);

    expect(mockRoom.makeAction).toHaveBeenCalledWith("colibri-gateway");
    const action = mockRoom._actions.get("colibri-gateway") as any;
    expect(action?.send).toHaveBeenCalledWith(gatewayInfo, undefined);
  });

  it("getColibriPeers returns discovered gateway peers", async () => {
    await client.join("test-room");

    expect(client.getColibriPeers().size).toBe(0);

    const gatewayAction = mockRoom._actions.get("colibri-gateway") as any;
    const onMessage = gatewayAction?.onMessage as (data: unknown, ctx: { peerId: string }) => void;

    onMessage(
      { baseUrl: "https://peer-a-colibri.com/v1", model: "GLM-5.2", region: "global" },
      { peerId: "peer-a" },
    );

    const peers = client.getColibriPeers();
    expect(peers.size).toBe(1);
    expect(peers.get("peer-a")).toMatchObject({
      baseUrl: "https://peer-a-colibri.com/v1",
      model: "GLM-5.2",
    });
  });
});
