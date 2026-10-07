import { useEffect, useState, useCallback } from "react";
import { useTrystero, useColibri } from "@/hooks/useTrysteroP2P";
import type { PythiaEvent, ImpactAnalysis, ColibriMetrics, PeerMetrics } from "@/types/pythia";

export function WorldCockpit() {
  const { network, events, impacts, isConnected, pingPeer } = useTrystero();
  const { status: colibriStatus, models } = useColibri();
  const [peerLatencies, setPeerLatencies] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!network?.peers.length) return;
    const interval = setInterval(async () => {
      const newLatencies: Record<string, number> = {};
      for (const peer of network.peers) {
        try {
          newLatencies[peer.id] = await pingPeer(peer.id);
        } catch {
          newLatencies[peer.id] = -1;
        }
      }
      setPeerLatencies(newLatencies);
    }, 5000);
    return () => clearInterval(interval);
  }, [network, pingPeer]);

  const onlinePeers = network?.peers.filter((p) => !p.id.startsWith("fellowship")) ?? [];
  const fellowshipNodes = network?.peers.filter((p) => p.id.startsWith("fellowship")) ?? [];

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-white">P2P Network Cockpit</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Connected Peers" value={network?.peerCount ?? 0} icon="👥" />
        <StatCard
          label="Pythia Events"
          value={events.length}
          icon="📡"
          trend={events.length > 0 ? "active" : undefined}
        />
        <StatCard
          label="Impact Alerts"
          value={impacts.length}
          icon="⚠️"
          trend={impacts.filter((i) => i.tier === "critical").length > 0 ? "critical" : undefined}
        />
        <StatCard
          label="Colibri WASM"
          value={colibriStatus?.loaded ? "Loaded" : "Unavailable"}
          icon="🧠"
          trend={colibriStatus?.loaded ? "active" : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PeerTable peers={onlinePeers} latencies={peerLatencies} />
        <FellowshipNodes nodes={fellowshipNodes} models={models} />
      </div>

      <ImpactHeatmap impacts={impacts} />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  trend,
}: {
  label: string;
  value: string | number;
  icon: string;
  trend?: "active" | "critical";
}) {
  const trendColor = trend === "active" ? "text-green-400" : trend === "critical" ? "text-red-400" : "text-gray-400";
  return (
    <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1">
          <p className="text-sm text-gray-400">{label}</p>
          <p className={`text-2xl font-bold ${trendColor}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

function PeerTable({
  peers,
  latencies,
}: {
  peers: NonNullable<ReturnType<typeof useTrystero>["network"]>["peers"];
  latencies: Record<string, number>;
}) {
  if (!peers.length) {
    return (
      <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-2">Active Peers</h3>
        <p className="text-gray-500">No peers connected</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-white mb-3">Active Peers</h3>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {peers.map((peer) => (
          <div key={peer.id} className="flex items-center justify-between text-sm">
            <span className="text-gray-300 font-mono text-xs">
              {peer.id.slice(0, 12)}...
            </span>
            <span className="text-gray-400">
              {latencies[peer.id] !== undefined
                ? `${latencies[peer.id]}ms`
                : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FellowshipNodes({
  nodes,
  models,
}: {
  nodes: NonNullable<ReturnType<typeof useTrystero>["network"]>["peers"];
  models: ReturnType<typeof useColibri>["models"];
}) {
  return (
    <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-white mb-3">Fellowship Nodes</h3>
      <div className="space-y-2">
        {nodes.map((node) => (
          <div key={node.id} className="flex items-center gap-3 text-sm">
            <span className={`w-2 h-2 rounded-full ${node.status === "online" ? "bg-green-400" : "bg-red-400"}`} />
            <span className="text-gray-300 font-mono text-xs">{node.id}</span>
            <span className="text-gray-500">({node.region})</span>
          </div>
        ))}
      </div>
      {models.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-gray-500 mb-1">Registered Models</p>
          <div className="flex flex-wrap gap-1">
            {models.map((m) => (
              <span key={m.cid} className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded">
                {m.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ImpactHeatmap({ impacts }: { impacts: ImpactAnalysis[] }) {
  const tiers = ["low", "medium", "high", "critical"] as const;
  const counts = tiers.reduce(
    (acc, tier) => {
      acc[tier] = impacts.filter((i) => i.tier === tier).length;
      return acc;
    },
    { low: 0, medium: 0, high: 0, critical: 0 },
  );

  return (
    <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-white mb-3">Impact Distribution</h3>
      <div className="grid grid-cols-4 gap-2">
        {tiers.map((tier) => (
          <div key={tier} className="text-center">
            <div className="text-2xl font-bold">{counts[tier]}</div>
            <div className="text-xs text-gray-400 capitalize">{tier}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 h-4 bg-gray-800 rounded-full overflow-hidden flex">
        {tiers.map((tier) => (
          <div
            key={tier}
            className="h-full transition-all"
            style={{
              width: `${(counts[tier] / Math.max(impacts.length, 1)) * 100}%`,
              backgroundColor:
                tier === "low"
                  ? "#10b981"
                  : tier === "medium"
                    ? "#f59e0b"
                    : tier === "high"
                      ? "#f97316"
                      : "#ef4444",
            }}
          />
        ))}
      </div>
    </div>
  );
}
