import { useEffect, useRef, useState, useCallback } from "react";
import { TrysteroP2PClient, type NetworkState } from "@/lib/trystero-client";
import { ColibriWASMClient, type ColibriModelInfo } from "@/lib/colibri-wasm-client";
import type {
  PythiaEvent,
  PythiaForecast,
  ImpactAnalysis,
  PeerMetrics,
} from "@/types/pythia";

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
  const clientRef = useRef<TrysteroP2PClient | null>(null);

  const updateNetwork = useCallback(() => {
    if (clientRef.current) {
      setNetwork(clientRef.current.getNetworkState());
    }
  }, []);

  useEffect(() => {
    if (!autoConnect) return;

    const client = new TrysteroP2PClient();
    clientRef.current = client;

    client.join(roomId).catch(console.error);

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

    return () => {
      unsubPeerJoin();
      unsubPeerLeave();
      unsubEvent();
      unsubForecast();
      unsubImpact();
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

  const pingPeer = useCallback((peerId: string) => {
    return clientRef.current?.ping(peerId);
  }, []);

  return {
    network,
    events,
    forecasts,
    impacts,
    broadcastEvent,
    broadcastForecast,
    broadcastImpact,
    pingPeer,
    isConnected: !!clientRef.current && network !== null,
  };
}

export function useColibri(baseUrl?: string) {
  const [models, setModels] = useState<ColibriModelInfo[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const clientRef = useRef<ColibriWASMClient | null>(null);

  useEffect(() => {
    clientRef.current = new ColibriWASMClient(baseUrl);
    clientRef.current.listModels().then(setModels).catch(console.error);
    clientRef.current.getStatus().then(setStatus).catch(console.error);
  }, [baseUrl]);

  const generate = useCallback(
    async (modelCid: string, prompt: string, opts?: any) => {
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
    const s = await clientRef.current.getStatus();
    setStatus(s);
  }, []);

  return {
    models,
    status,
    loading,
    generate,
    registerModel,
    refreshStatus,
  };
}

export function useNetworkPoll(intervalMs = 10000) {
  const [metrics, setMetrics] = useState<PeerMetrics[]>([]);
  const [round, setRound] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setRound((r) => r + 1);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return { metrics, round };
}
