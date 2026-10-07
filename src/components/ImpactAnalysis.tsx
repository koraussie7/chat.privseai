import { useTrystero } from "@/hooks/useTrysteroP2P";
import { IMPACT_TIER_COLORS } from "@/types/pythia";
import type {
	ImpactAnalysis as ImpactAnalysisData,
	PythiaEvent,
	PythiaForecast,
} from "@/types/pythia";
import { useMemo, useState } from "react";

const IMPACT_TIERS = ["low", "medium", "high", "critical"] as const;
const IMPACT_TIER_LABELS = {
	low: "Low",
	medium: "Medium",
	high: "High",
	critical: "Critical",
};

export function ImpactAnalysis() {
	const { events, impacts, forecasts } = useTrystero();
	const [selectedTier, setSelectedTier] = useState<string>("all");
	const [activeTab, setActiveTab] = useState<"chart" | "list" | "agents">("chart");

	const filteredImpacts = useMemo(() => {
		if (selectedTier === "all") return impacts;
		return impacts.filter((i) => i.tier === selectedTier);
	}, [impacts, selectedTier]);

	const tierCounts = useMemo(
		() =>
			IMPACT_TIERS.reduce(
				(acc, tier) => {
					acc[tier] = impacts.filter((i) => i.tier === tier).length;
					return acc;
				},
				{ low: 0, medium: 0, high: 0, critical: 0 },
			),
		[impacts],
	);

	const maxTierCount = Math.max(...Object.values(tierCounts), 1);

	const affectedAgentMap = useMemo(() => {
		const map = new Map<string, number>();
		for (const impact of impacts) {
			for (const agent of impact.affected_agents) {
				map.set(agent, (map.get(agent) ?? 0) + 1);
			}
		}
		return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
	}, [impacts]);

	return (
		<div className="space-y-6 p-6">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold text-white">Impact Analysis</h1>
				<div className="flex items-center gap-2 text-sm text-gray-400">
					<span>{impacts.length} total analyses</span>
				</div>
			</div>

			<div className="flex gap-1 bg-gray-800/50 rounded-lg p-1">
				{(["chart", "list", "agents"] as const).map((tab) => (
					<button
						type="button"
						key={tab}
						onClick={() => setActiveTab(tab)}
						className={`px-4 py-2 rounded text-sm font-medium transition-all ${
							activeTab === tab ? "bg-blue-600 text-white" : "text-gray-400 hover:text-gray-200"
						}`}
					>
						{tab.charAt(0).toUpperCase() + tab.slice(1)}
					</button>
				))}
			</div>

			<div>
				<label htmlFor="impact-tier-filter" className="text-xs text-gray-400">
					Filter by Tier
				</label>
				<select
					id="impact-tier-filter"
					value={selectedTier}
					onChange={(e) => setSelectedTier(e.target.value)}
					className="mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1 text-sm text-gray-100"
				>
					<option value="all">All Tiers</option>
					{IMPACT_TIERS.map((tier) => (
						<option key={tier} value={tier}>
							{IMPACT_TIER_LABELS[tier]} ({tierCounts[tier]})
						</option>
					))}
				</select>
			</div>

			{activeTab === "chart" && (
				<ImpactChart
					tierCounts={tierCounts}
					maxTierCount={maxTierCount}
					events={events}
					forecasts={forecasts}
				/>
			)}

			{activeTab === "list" && <ImpactList impacts={filteredImpacts} />}

			{activeTab === "agents" && (
				<AgentImpactView affectedAgentMap={affectedAgentMap} impacts={filteredImpacts} />
			)}
		</div>
	);
}

function ImpactChart({
	tierCounts,
	maxTierCount,
	events,
	forecasts,
}: {
	tierCounts: Record<ImpactAnalysisData["tier"], number>;
	maxTierCount: number;
	events: PythiaEvent[];
	forecasts: PythiaForecast[];
}) {
	return (
		<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
				<h3 className="text-lg font-semibold text-white mb-4">Impact Tier Distribution</h3>
				<div className="space-y-3">
					{IMPACT_TIERS.map((tier) => {
						const colorClass =
							tier === "low"
								? "bg-green-500"
								: tier === "medium"
									? "bg-amber-500"
									: tier === "high"
										? "bg-orange-500"
										: "bg-red-500";
						const count = tierCounts[tier];
						const pct = (count / maxTierCount) * 100;
						return (
							<div key={tier} className="flex items-center gap-3">
								<span className="w-16 text-xs font-medium text-gray-400">
									{IMPACT_TIER_LABELS[tier]}
								</span>
								<div className="flex-1 bg-gray-800 rounded-full h-4 relative">
									<div
										className={`h-full rounded-full transition-all ${colorClass}`}
										style={{ width: `${pct}%` }}
									/>
								</div>
								<span className="w-8 text-right text-sm font-bold text-gray-300">{count}</span>
							</div>
						);
					})}
				</div>
			</div>

			<div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
				<h3 className="text-lg font-semibold text-white mb-4">Activity Summary</h3>
				<div className="space-y-3">
					<StatRow label="Total Events" value={events.length} />
					<StatRow label="Total Forecasts" value={forecasts.length} />
					<StatRow
						label="Resolved Forecasts"
						value={forecasts.filter((f) => f.resolved_at).length}
					/>
					<StatRow label="Critical Impacts" value={tierCounts.critical} color="text-red-400" />
				</div>
			</div>
		</div>
	);
}

function StatRow({
	label,
	value,
	color = "text-gray-300",
}: {
	label: string;
	value: number;
	color?: string;
}) {
	return (
		<div className="flex justify-between">
			<span className="text-sm text-gray-400">{label}</span>
			<span className={`text-sm font-medium ${color}`}>{value}</span>
		</div>
	);
}

function ImpactList({ impacts }: { impacts: ImpactAnalysisData[] }) {
	if (!impacts.length) {
		return (
			<div className="text-center py-12 text-gray-500">No impacts match the current filter.</div>
		);
	}

	return (
		<div className="space-y-3">
			{impacts
				.slice()
				.reverse()
				.map((impact) => {
					const colorClass = IMPACT_TIER_COLORS[impact.tier] || IMPACT_TIER_COLORS.low;
					return (
						<div
							key={`${impact.target_id}-${impact.target_type}`}
							className="bg-gray-900/30 border border-gray-700 rounded-lg p-4"
						>
							<div className="flex items-start justify-between">
								<div className="flex items-center gap-3">
									<span className={`text-xs font-bold uppercase ${colorClass}`}>
										{IMPACT_TIER_LABELS[impact.tier]}
									</span>
									<span className="text-xs text-gray-500">
										score: {(impact.score * 100).toFixed(0)}/100
									</span>
								</div>
								<span className="text-xs text-gray-500">
									{new Date(impact.generated_at).toLocaleDateString()}
								</span>
							</div>
							<p className="text-sm text-gray-300 mt-2">{impact.rationale}</p>
							<div className="grid grid-cols-2 gap-4 mt-3">
								<div>
									<p className="text-xs text-gray-500">Affected Agents</p>
									<div className="flex flex-wrap gap-1 mt-1">
										{impact.affected_agents.slice(0, 4).map((a) => (
											<span
												key={a}
												className="text-xs bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded"
											>
												{a.slice(0, 8)}...
											</span>
										))}
									</div>
								</div>
								<div>
									<p className="text-xs text-gray-500">Affected Domains</p>
									<div className="flex flex-wrap gap-1 mt-1">
										{impact.affected_domains.slice(0, 4).map((d) => (
											<span
												key={d}
												className="text-xs bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded"
											>
												{d}
											</span>
										))}
									</div>
								</div>
							</div>
						</div>
					);
				})}
		</div>
	);
}

function AgentImpactView({
	affectedAgentMap,
	impacts,
}: {
	affectedAgentMap: [string, number][];
	impacts: ImpactAnalysisData[];
}) {
	const maxImpact = Math.max(...affectedAgentMap.map(([, count]) => count), 1);

	return (
		<div className="space-y-4">
			<h3 className="text-lg font-semibold text-white mb-3">Agent Impact Rankings</h3>
			<div className="space-y-3">
				{affectedAgentMap.map(([agent, count]) => {
					const agentImpacts = impacts.filter((i) => i.affected_agents.includes(agent));
					const criticalCount = agentImpacts.filter((i) => i.tier === "critical").length;

					return (
						<div key={agent} className="bg-gray-900/30 border border-gray-700 rounded-lg p-3">
							<div className="flex items-center justify-between">
								<span className="text-sm font-medium text-gray-200 font-mono">
									{agent.slice(0, 16)}...
								</span>
								<span className="text-xs text-gray-500">
									{count} impacts {criticalCount > 0 && `(${criticalCount} critical)`}
								</span>
							</div>
							<div className="mt-2 h-2 bg-gray-800 rounded-full overflow-hidden">
								<div
									className="h-full bg-red-500 transition-all"
									style={{ width: `${(count / maxImpact) * 100}%` }}
								/>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
