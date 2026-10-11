import { StatusPill } from "@/components/StatusPill";
import { useColibri, useTrystero } from "@/hooks/useTrysteroP2P";
import type { ImpactAnalysis } from "@/types/pythia";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

export function WorldCockpit() {
	const { network, events, impacts, pingPeer } = useTrystero();
	const { status: colibriStatus, connection: colibriConnection, models } = useColibri();
	const [peerLatencies, setPeerLatencies] = useState<Record<string, number>>({});

	useEffect(() => {
		if (!network?.peers.length) return;
		const interval = setInterval(async () => {
			const newLatencies: Record<string, number> = {};
			for (const peer of network.peers) {
				try {
					newLatencies[peer.id] = (await pingPeer(peer.id)) ?? -1;
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
		<div className="mx-auto max-w-[1440px] space-y-8 px-4 py-8 sm:px-6 lg:px-8">
			<section className="relative overflow-hidden rounded-3xl border-cyan-200/10 bg-gradient-to-br from-[#101e31] via-[#0d1725] to-[#101322] p-6 shadow-2xl shadow-black/20 sm:p-9">
				<div className="pointer-events-none absolute -right-16 -top-24 h-80 w-80 rounded-full bg-cyan-400/[0.08] blur-3xl" />
				<div className="pointer-events-none absolute -bottom-36 left-1/3 h-64 w-64 rounded-full bg-blue-500/[0.08] blur-3xl" />
				<div className="relative flex-col justify-between gap-8 lg:flex-row lg:items-end">
					<div className="max-w-2xl">
						<p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200/70">
							Decentralized intelligence network
						</p>
						<h1 className="text-3xl font-semibold text-white sm:text-4xl">World Cockpit</h1>
						<p className="mt-3 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">
							A live operations view of peer connectivity, agent activity, and inference capacity
							across your network.
						</p>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<StatusPill
							label={network ? `Signaling · ${network.strategy}` : "Connecting to mesh"}
							tone={network ? "good" : "warn"}
						/>
						<StatusPill label={`Peer ID · ${(network?.selfId || "discovering").slice(0, 12)}`} />
					</div>
				</div>
				<div className="relative mt-8 grid-cols-2 gap-3 sm:grid-cols-4">
					<StatCard label="Connected peers" value={network?.peerCount ?? 0} icon="↗" />
					<StatCard
						label="Pythia events"
						value={events.length}
						icon="⌁"
						trend={events.length > 0 ? "active" : undefined}
					/>
					<StatCard
						label="Impact alerts"
						value={impacts.length}
						icon="◇"
						trend={impacts.some((i) => i.tier === "critical") ? "critical" : undefined}
					/>
					<StatCard
						label="Colibri inference"
						value={
							colibriStatus?.loaded
								? "Ready"
								: colibriConnection === "unreachable"
									? "No node"
									: "Offline"
						}
						icon="◈"
						trend={colibriStatus?.loaded ? "active" : undefined}
					/>
				</div>
			</section>

			<section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
				<div className="lg:col-span-7">
					<PeerTable peers={onlinePeers} latencies={peerLatencies} />
				</div>
				<div className="lg:col-span-5">
					<FellowshipNodes nodes={fellowshipNodes} models={models} />
				</div>
			</section>

			<ImpactHeatmap impacts={impacts} />
		</div>
	);
}

function SectionHeading({
	eyebrow,
	title,
	aside,
}: {
	eyebrow: string;
	title: string;
	aside?: ReactNode;
}) {
	return (
		<div className="flex items-center justify-between gap-4">
			<div>
				<p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/55">
					{eyebrow}
				</p>
				<h2 className="mt-1 text-lg font-semibold text-white">{title}</h2>
			</div>
			{aside}
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
	const trendColor =
		trend === "active" ? "text-emerald-200" : trend === "critical" ? "text-rose-200" : "text-white";
	const iconColor =
		trend === "critical"
			? "text-rose-300"
			: trend === "active"
				? "text-emerald-300"
				: "text-cyan-200";
	return (
		<div className="group rounded-2xl border-white/[0.07] bg-white/[0.035] p-4 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-200/20 hover:bg-white/[0.055] sm:p-5">
			<div className="flex items-start justify-between gap-2">
				<div>
					<p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
						{label}
					</p>
					<p className={`mt-3 text-2xl font-semibold tracking-tight sm:text-3xl ${trendColor}`}>
						{value}
					</p>
				</div>
				<span
					className={`flex h-9 w-9 items-center justify-center rounded-xl border-white/[0.07] bg-white/[0.035] text-xl ${iconColor}`}
					aria-hidden="true"
				>
					{icon}
				</span>
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
	return (
		<div className="h-full rounded-2xl border-white/[0.07] bg-white/[0.025] p-5 sm:p-6">
			<SectionHeading
				eyebrow="WebRTC data plane"
				title="Active peers"
				aside={
					<StatusPill
						label={peers.length ? `${peers.length} online` : "Waiting for peers"}
						tone={peers.length ? "good" : "warn"}
					/>
				}
			/>
			{peers.length === 0 ? (
				<div className="mt-6 flex min-h-36 flex-col items-center justify-center rounded-xl border-dashed border-white/10 bg-black/10 text-center">
					<span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border-cyan-200/10 bg-cyan-200/[0.05] text-cyan-200">
						⌁
					</span>
					<p className="text-sm font-medium text-slate-300">No peers connected yet</p>
					<p className="mt-1 text-xs text-slate-500">Peers appear here when they join this room.</p>
				</div>
			) : (
				<div className="mt-5 max-h-64 space-y-2 overflow-y-auto">
					{peers.map((peer) => (
						<div
							key={peer.id}
							className="flex items-center justify-between gap-4 rounded-xl border-white/[0.04] bg-white/[0.02] px-3 py-3 text-sm"
						>
							<span className="flex min-w-0 items-center gap-3">
								<span className="h-2 w-2 shrink-0 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.5)]" />
								<span className="truncate font-mono text-xs text-slate-300">{peer.id}</span>
							</span>
							<span className="shrink-0 font-mono text-xs text-slate-400">
								{latencies[peer.id] !== undefined && latencies[peer.id] >= 0
									? `${latencies[peer.id]} ms`
									: "Probing"}
							</span>
						</div>
					))}
				</div>
			)}
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
		<div className="h-full rounded-2xl border-white/[0.07] bg-white/[0.025] p-5 sm:p-6">
			<SectionHeading
				eyebrow="Inference layer"
				title="Fellowship nodes"
				aside={
					<StatusPill
						label={`${nodes.length} discovered`}
						tone={nodes.length ? "good" : "neutral"}
					/>
				}
			/>
			{nodes.length > 0 ? (
				<div className="mt-5 space-y-2">
					{nodes.map((node) => (
						<div
							key={node.id}
							className="flex items-center gap-3 rounded-xl border-white/[0.04] bg-white/[0.02] px-3 py-3 text-sm"
						>
							<span className="h-2 w-2 shrink-0 rounded-full bg-emerald-300" aria-label="online" />
							<span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-300">
								{node.id}
							</span>
							<span className="shrink-0 text-xs text-slate-500">{node.region}</span>
						</div>
					))}
				</div>
			) : (
				<div className="mt-6 rounded-xl border-dashed border-white/10 p-4 text-sm text-slate-500">
					No Fellowship gateway is currently advertising in this room.
				</div>
			)}
			{models.length > 0 && (
				<div className="mt-5">
					<p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
						Registered models
					</p>
					<div className="flex flex-wrap gap-2">
						{models.map((model) => (
							<span
								key={model.cid}
								className="rounded-lg border-cyan-200/10 bg-cyan-200/[0.04] px-2.5 py-1.5 text-xs text-cyan-100/80"
							>
								{model.name}
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
