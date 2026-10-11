// @vitest-environment jsdom

import { ColibriWASMClient } from "@/lib/colibri-wasm-client";
import * as config from "@/lib/config";
import * as hooks from "@/hooks/useTrysteroP2P";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Referenced through the namespace object (never destructured) so that
// vi.spyOn(hooks, "useTrystero") is what the hook-under-test actually resolves.
const useColibri = hooks.useColibri;
const useColibriGatewayAdvert = hooks.useColibriGatewayAdvert;

const LOADED_STATUS = {
  loaded: true,
  nativeLoaded: false,
  memoryUsed: 1024,
  memoryTotal: 4096,
  threads: 4,
  modelLoaded: "qwen3-0.6b",
  modelsAvailable: 1,
};

/**
 * Covers the Colibri gateway discovery path that was silently broken:
 * `broadcastColibriGateway` existed on the client but nothing in the app ever
 * called it, so `colibriPeers` stayed empty and distributed inference — which
 * resolves an endpoint from `colibriPeers` — could never run.
 */
describe("useColibriGatewayAdvert", () => {
  let broadcast: ReturnType<typeof vi.fn>;
  let registerClientReady: ReturnType<typeof vi.fn>;

  /** Stubs `useTrystero`, which the hook under test calls internally. */
  function mockUseTrystero(peers: { id: string }[] = []) {
    vi.mocked(hooks.useTrystero).mockReturnValue({
      network: { peers, selfId: "self-peer-1", peerCount: peers.length },
      events: [],
      forecasts: [],
      impacts: [],
      colibriPeers: [],
      broadcast,
      registerClientReady,
      pingPeer: vi.fn(),
      isConnected: true,
    } as unknown as ReturnType<typeof hooks.useTrystero>);
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    broadcast = vi.fn();
    registerClientReady = vi.fn(() => () => {});
    // Must be spied on before `vi.mocked(...)` is usable in mockUseTrystero.
    vi.spyOn(hooks, "useTrystero");

    vi.spyOn(config, "COLIBRI_ADVERT_ENABLED", "get").mockReturnValue(true);
    vi.spyOn(config, "COLIBRI_ADVERT_INTERVAL_MS", "get").mockReturnValue(60_000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is a no-op when advertising is not enabled", async () => {
    vi.spyOn(config, "COLIBRI_ADVERT_ENABLED", "get").mockReturnValue(false);
    vi.spyOn(ColibriWASMClient.prototype, "getBaseUrl").mockReturnValue(
      "https://fellowship.example.com",
    );
    vi.spyOn(ColibriWASMClient.prototype, "getStatus").mockResolvedValue(LOADED_STATUS);
    mockUseTrystero();

    const { result } = renderHook(() => useColibriGatewayAdvert({ broadcast }));

    await waitFor(() => expect(result.current.state).toBe("disabled"));
    expect(broadcast).not.toHaveBeenCalled();
  });

  it("never advertises a localhost gateway (peers cannot dial loopback)", async () => {
    vi.spyOn(ColibriWASMClient.prototype, "getBaseUrl").mockReturnValue(
      "http://localhost:3001",
    );
    vi.spyOn(ColibriWASMClient.prototype, "getStatus").mockResolvedValue(LOADED_STATUS);
    mockUseTrystero();

    const { result } = renderHook(() => useColibriGatewayAdvert({ broadcast }));

    await waitFor(() => expect(result.current.state).toBe("offline"));
    expect(broadcast).not.toHaveBeenCalled();
  });

  it("advertises a public gateway whose Colibri engine is loaded", async () => {
    vi.spyOn(ColibriWASMClient.prototype, "getBaseUrl").mockReturnValue(
      "https://fellowship.example.com",
    );
    vi.spyOn(ColibriWASMClient.prototype, "getStatus").mockResolvedValue(LOADED_STATUS);
    mockUseTrystero();

    const { result } = renderHook(() => useColibriGatewayAdvert({ broadcast }));

    await waitFor(() => expect(result.current.state).toBe("advertising"));
    expect(broadcast).toHaveBeenCalledTimes(1);
    expect(broadcast.mock.calls[0][0]).toMatchObject({
      baseUrl: "https://fellowship.example.com",
      model: "qwen3-0.6b",
      isPublic: true,
    });
    // peerId must identify us on the mesh, not be empty.
    expect(broadcast.mock.calls[0][0].peerId).toBeTruthy();
  });

  it("stays offline when the node answers but Colibri is not loaded", async () => {
    vi.spyOn(ColibriWASMClient.prototype, "getBaseUrl").mockReturnValue(
      "https://fellowship.example.com",
    );
    vi.spyOn(ColibriWASMClient.prototype, "getStatus").mockResolvedValue({
      ...LOADED_STATUS,
      loaded: false,
    });
    mockUseTrystero();

    const { result } = renderHook(() => useColibriGatewayAdvert({ broadcast }));

    await waitFor(() => expect(result.current.state).toBe("offline"));
    expect(broadcast).not.toHaveBeenCalled();
  });

  it("stays offline when the node is unreachable", async () => {
    vi.spyOn(ColibriWASMClient.prototype, "getBaseUrl").mockReturnValue(
      "https://fellowship.example.com",
    );
    vi.spyOn(ColibriWASMClient.prototype, "getStatus").mockRejectedValue(
      new Error("ECONNREFUSED"),
    );
    mockUseTrystero();

    const { result } = renderHook(() => useColibriGatewayAdvert({ broadcast }));

    await waitFor(() => expect(result.current.state).toBe("offline"));
    expect(broadcast).not.toHaveBeenCalled();
  });
});


describe("useColibri connection state", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports 'unreachable' when the status probe fails", async () => {
    // Both a booting node and a dead node leave `status` null, so the hook must
    // expose a separate connection state for the UI to tell them apart.
    vi.spyOn(ColibriWASMClient.prototype, "getStatus").mockRejectedValue(
      new Error("fetch failed"),
    );
    vi.spyOn(ColibriWASMClient.prototype, "listModels").mockRejectedValue(
      new Error("fetch failed"),
    );

    const { result } = renderHook(() => useColibri());

    await waitFor(() => expect(result.current.connection).toBe("unreachable"));
    expect(result.current.status).toBeNull();
  });

  it("reports 'online' and exposes status when the node answers", async () => {
    vi.spyOn(ColibriWASMClient.prototype, "getStatus").mockResolvedValue(LOADED_STATUS);
    vi.spyOn(ColibriWASMClient.prototype, "listModels").mockResolvedValue([]);

    const { result } = renderHook(() => useColibri());

    await waitFor(() => expect(result.current.connection).toBe("online"));
    expect(result.current.status?.loaded).toBe(true);
  });

  it("does not warn on state updates after unmount", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(ColibriWASMClient.prototype, "getStatus").mockRejectedValue(
      new Error("aborted"),
    );
    vi.spyOn(ColibriWASMClient.prototype, "listModels").mockResolvedValue([]);

    const { unmount } = renderHook(() => useColibri());
    unmount();

    await act(async () => {
      await Promise.resolve();
    });
    // React would log "update on unmounted component" if the hook set state
    // without guarding against a cancelled probe.
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
