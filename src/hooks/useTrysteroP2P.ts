import {
	type ColibriGenerateOptions,
	type ColibriModelInfo,
	ColibriWASMClient,
} from "@/lib/colibri-wasm-client";
import { type ColibriGatewayInfo, type NetworkState, TrysteroP2PClient } from "@/lib/trystero-client";
import type { ImpactAnalysis, PythiaEvent, PythiaForecast } from "@/types/pythia";
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
		const unsubGateway = client.onColibriGateway(() => {
			const peers = client.getColibriPeers();
			setColibriPeers(Array.from(peers.values()));
		});

		return () => {
			unsubPeerJoin();
			unsubPeerLeave();
			unsubEvent();
			unsubForecast();
			unsubImpact();
			unsubGateway();
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
		isConnected: !!clientRef.current && network !== null,
	};
}

export function useColibri(baseUrl?: string) {
	const [models, setModels] = useState<ColibriModelInfo[]>([]);
	const [status, setStatus] = useState<Awaited<ReturnType<ColibriWASMClient["getStatus"]>> | null>(
		null,
	);
	const [loading, setLoading] = useState(false);
	const clientRef = useRef<ColibriWASMClient | null>(null);

	useEffect(() => {
		clientRef.current = new ColibriWASMClient(baseUrl);
		clientRef.current.listModels().then(setModels).catch(console.error);
		clientRef.current.getStatus().then(setStatus).catch(console.error);
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
	const [round, setRound] = useState(0);

	useEffect(() => {
		const timer = setInterval(() => {
			setRound((r) => r + 1);
		}, intervalMs);
		return () => clearInterval(timer);
	}, [intervalMs]);

	return { round };
}
