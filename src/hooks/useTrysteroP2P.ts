import {
  type ColibriGenerateOptions,
  type ColibriModelInfo,
  ColibriWASMClient,
} from "@/lib/colibri-wasm-client";
import { REGION, COLIBRI_ADVERT_ENABLED, COLIBRI_ADVERT_INTERVAL_MS } from "@/lib/config";
import {
  type ColibriGatewayInfo,
  type NetworkState,
  TrysteroP2PClient,
} from "@/lib/trystero-client";
import type {
  ImpactAnalysis,
  PythiaEvent,
  PythiaForecast,
} from "@/types/pythia";
import { useCallback, useEffect, useRef, useState } from "react";

interface UseTrysteroOptions {
  roomId?: string;
  autoConnect?: boolean;
}

const DEFAULT_ROOM = "p2pclaw:main";

export function useTrystero(options: UseTrysteroOptions = {}) {
  const { roomId = DEFAULT_ROOM, autoConnect = true } = options;
  const [network, setNetwork] = useState<NetworkState | null>(null);
  const [events, setEvents] = useState<PythiaEvent[]>([]);
  const [forecasts, setForecasts] = useState<PythiaForecast[]>([]);
  const [impacts, setImpacts] = useState<ImpactAnalysis[]>([]);
  const [colibriPeers, setColibriPeers] = useState<ColibriGatewayInfo[]>([]);
  const clientRef = useRef<TrysteroP2PClient | null>(null);
  const clientReadyRef = useRef(new Set<(client: TrysteroP2PClient) => void>());

  const updateNetwork = useCallback(() => {
    if (clientRef.current) {
      setNetwork(clientRef.current.getNetworkState());
    }
  }, []);

  useEffect(() => {
    if (!autoConnect) return;

    const client = new TrysteroP2PClient();
    clientRef.current = client;
    for (const callback of clientReadyRef.current) callback(client);
    setNetwork(client.getNetworkState());

    client.join(roomId).catch((err) => {
			console.warn("[useTrystero] P2P join failed (offline mode):", err?.message || err);
		});

    const unsubPeerJoin = client.onPeerJoin(() => updateNetwork());
    const unsubPeerLeave = client.onPeerLeave(() => updateNetwork());
    const unsubEvent = client.onPythiaEvent((data) => {
      setEvents((prev) => {
        const next = [...prev, data as PythiaEvent];
        return next.length > 100 ? next.slice(next.length - 100) : next;
      });
    });
    const unsubForecast = client.onPythiaForecast((data) => {
      setForecasts((prev) => {
        const next = [...prev, data as PythiaForecast];
        return next.length > 50 ? next.slice(next.length - 50) : next;
      });
    });
    const unsubImpact = client.onImpactAlert((data) => {
      setImpacts((prev) => {
        const next = [...prev, data as ImpactAnalysis];
        return next.length > 50 ? next.slice(next.length - 50) : next;
      });
    });
    const unsubGateway = client.onColibriGateway(() => {
      const peers = client.getColibriPeers();
      setColibriPeers(Array.from(peers.values()));
    });
    const unsubAIPackage = client.onAIPackage(() => updateNetwork());
    const unsubColibriPeerJoin = client.onPeerJoin(() => {
      setColibriPeers(Array.from(client.getColibriPeers().values()));
    });

    return () => {
      unsubPeerJoin();
      unsubPeerLeave();
      unsubEvent();
      unsubForecast();
      unsubImpact();
      unsubGateway();
      unsubAIPackage();
      unsubColibriPeerJoin();
      client.leave();
      clientRef.current = null;
    };
  }, [roomId, autoConnect, updateNetwork]);

  const broadcastEvent = useCallback((event: PythiaEvent) => {
    clientRef.current?.broadcastEvent(event);
  }, []);

  const broadcastForecast = useCallback((forecast: PythiaForecast) => {
    clientRef.current?.broadcastForecast(forecast);
  }, []);

  const broadcastImpact = useCallback((impact: ImpactAnalysis) => {
    clientRef.current?.broadcastImpact(impact);
  }, []);

  const broadcastColibriGateway = useCallback((info: ColibriGatewayInfo) => {
    clientRef.current?.broadcastColibriGateway(info);
  }, []);

  const pingPeer = useCallback((peerId: string) => {
    return clientRef.current?.ping(peerId);
  }, []);

  const registerClientReady = useCallback(
    (callback: (client: TrysteroP2PClient) => void) => {
      clientReadyRef.current.add(callback);
      if (clientRef.current) callback(clientRef.current);
      return () => {
        clientReadyRef.current.delete(callback);
      };
    },
    [],
  );

  return {
    network,
    events,
    forecasts,
    impacts,
    colibriPeers,
    broadcastEvent,
    broadcastForecast,
    broadcastImpact,
    broadcastColibriGateway,
    pingPeer,
    registerClientReady,
    isConnected: !!clientRef.current && network !== null,
  };
}

export type ColibriConnectionState = "pending" | "online" | "unreachable";

export function useColibri(baseUrl?: string) {
  const [models, setModels] = useState<ColibriModelInfo[]>([]);
  const [status, setStatus] = useState<Awaited<
    ReturnType<ColibriWASMClient["getStatus"]>
  > | null>(null);
  // Distinguishes "node answered" from "node unreachable". Both leave `status`
  // null, so `status?.loaded` alone renders a dead node as merely "Offline"
  // with no way to tell it apart from a node still booting.
  const [connection, setConnection] = useState<ColibriConnectionState>("pending");
  const [loading, setLoading] = useState(false);
  const clientRef = useRef<ColibriWASMClient | null>(null);

  useEffect(() => {
    clientRef.current = new ColibriWASMClient(baseUrl);
    setConnection("pending");
    setStatus(null);
    clientRef.current.listModels().then(setModels).catch(() => setModels([]));
    clientRef.current
      .getStatus()
      .then((s) => {
        setStatus(s);
        setConnection("online");
      })
      .catch(() => setConnection("unreachable"));
  }, [baseUrl]);

  const generate = useCallback(
    async (modelCid: string, prompt: string, opts?: ColibriGenerateOptions) => {
      if (!clientRef.current) return null;
      setLoading(true);
      try {
        const result = await clientRef.current.generate(modelCid, prompt, opts);
        return result;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const registerModel = useCallback(
    async (cid: string, name: string, size: number, quant: string) => {
      if (!clientRef.current) return false;
      const ok = await clientRef.current.registerModel(cid, name, size, quant);
      clientRef.current.listModels().then(setModels).catch(console.error);
      return ok;
    },
    [],
  );

  const refreshStatus = useCallback(async () => {
    if (!clientRef.current) return;
    try {
      const s = await clientRef.current.getStatus();
      setStatus(s);
      setConnection("online");
    } catch {
      setConnection("unreachable");
    }
  }, []);

  return {
    models,
    status,
    connection,
    loading,
    generate,
    registerModel,
    refreshStatus,
  };
}

export function useNetworkPoll(intervalMs = 10000) {
  const [round, setRound] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setRound((r) => r + 1);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return { round };
}

/**
 * Advertise this peer's Colibri gateway to the P2P mesh.
 *
 * `broadcastColibriGateway` existed on the client but nothing ever called it, so
 * `colibriPeers` stayed permanently empty and distributed inference could never
 * discover a peer. This hook closes that loop:
 *
 *  1. Probe the Fellowship node's `/api/colibri/status` — only a node that is
 *     actually reachable and has Colibri loaded is worth advertising.
 *  2. Broadcast `colibri-gateway` when the probe succeeds, then re-broadcast on
 *     an interval and whenever the peer set grows, because Trystero actions are
 *     not replayed to peers that join later.
 *
 * A localhost base URL is never advertised: peers cannot reach it, and
 * CandyChatPage filters localhost endpoints out anyway. Enable via
 * VITE_COLIBRI_ADVERT_ENABLED=true once VITE_FELLOWSHIP_URL is a public origin.
 *
 * Returns the gateway state for status UI: "disabled" | "offline" | "advertising".
 */
export function useColibriGatewayAdvert(
  options: {
    intervalMs?: number;
    /**
     * Injectable broadcast sink. Defaults to the one from `useTrystero()`, but
     * because this hook lives in the same module an intra-module call cannot be
     * intercepted with `vi.spyOn(hooks, "useTrystero")` — tests pass their own
     * spy here instead of reaching across module boundaries.
     */
    broadcast?: (info: ColibriGatewayInfo) => void;
  } = {},
) {
  const { intervalMs = COLIBRI_ADVERT_INTERVAL_MS, broadcast: broadcastOverride } =
    options;
  const { network, broadcastColibriGateway, registerClientReady } = useTrystero();
  const broadcast = broadcastOverride ?? broadcastColibriGateway;
  const [state, setState] = useState<"disabled" | "offline" | "advertising">("offline");

  const peerCount = network?.peers.length ?? 0;
  const lastAdvertisedAt = useRef(0);

  useEffect(() => {
    if (!COLIBRI_ADVERT_ENABLED) {
      setState("disabled");
      return;
    }

    const client = new ColibriWASMClient();
    const baseUrl = client.getBaseUrl();
    // Peers cannot dial into our loopback interface.
    const isPublicBase =
      /^https?:\/\//.test(baseUrl) && !/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(baseUrl);

    let cancelled = false;

    const advert = async () => {
      if (cancelled || !isPublicBase) return;
      try {
        const status = await client.getStatus();
        // Only advertise a node whose Colibri engine is actually loaded.
        if (cancelled || !status?.loaded) {
          setState("offline");
          return;
        }
        broadcast({
          baseUrl,
          model: status.modelLoaded ?? undefined,
          region: REGION,
          peerId: network?.selfId ?? "",
          timestamp: Date.now(),
          isPublic: true,
        });
        lastAdvertisedAt.current = Date.now();
        setState("advertising");
      } catch {
        setState("offline");
      }
    };

    void advert();

    const timer = setInterval(() => {
      void advert();
    }, intervalMs);

    // Re-advertise when peers join: Trystero does not replay past actions.
    if (peerCount > 0 && Date.now() - lastAdvertisedAt.current > 10_000) {
      void advert();
    }

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [intervalMs, peerCount, broadcastColibriGateway, registerClientReady, network?.selfId]);

  return { state };
}
