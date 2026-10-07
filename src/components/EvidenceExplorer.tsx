import { useColibri, useTrystero } from "@/hooks/useTrysteroP2P";
import { IMPACT_TIER_COLORS } from "@/types/pythia";
import type { ColibriMetrics, ImpactAnalysis, PythiaEvent } from "@/types/pythia";
import { useState } from "react";

export function EvidenceExplorer() {
	const { impacts, events } = useTrystero();
	const { status: colibriStatus } = useColibri();
	const [selectedImpact, setSelectedImpact] = useState<string | null>(null);
	const [showMetrics, setShowMetrics] = useState(false);

	const colibriMetrics: ColibriMetrics | null = colibriStatus
		? {
				modelName: colibriStatus.modelLoaded ?? "unknown",
				modelCid: "",
				vocabSize: 0,
				hiddenSize: 0,
				numLayers: 0,
				numHeads: 0,
				headDim: 0,
				maxSeqLen: 0,
				tokensGenerated: 0,
				tokensPerSecond: 0,
				memoryUsedMB: colibriStatus.memoryUsed,
				memoryTotalMB: colibriStatus.memoryTotal,
				loadTimeMs: 0,
				timestamp: Date.now(),
			}
		: null;

	return (
		<div className="space-y-6 p-6">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold text-white">Evidence Explorer</h1>
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={() => setShowMetrics(!showMetrics)}
						className="px-3 py-1 text-xs bg-gray-800 text-gray-300 rounded hover:bg-gray-700 transition-colors"
					>
						{showMetrics ? "Hide" : "Show"} Colibri Metrics
					</button>
				</div>
			</div>

			{showMetrics && colibriMetrics && <ColibriMetricsPanel metrics={colibriMetrics} />}

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<div className="lg:col-span-1">
					<h2 className="text-lg font-semibold text-white mb-3">Impact Alerts</h2>
					<div className="space-y-2 max-h-[600px] overflow-y-auto">
						{impacts.length === 0 ? (
							<p className="text-gray-500 text-sm">No impact alerts.</p>
						) : (
							impacts
								.slice()
								.reverse()
								.map((impact) => {
									const colorClass = IMPACT_TIER_COLORS[impact.tier] || IMPACT_TIER_COLORS.low;
									const key = `${impact.target_id}-${impact.target_type}`;
									return (
										<button
											type="button"
											key={key}
											onClick={() => setSelectedImpact(key)}
											className={`w-full text-left p-3 rounded-lg border cursor-pointer transition-all ${
												selectedImpact === key
													? "border-blue-500 bg-gray-800/70"
													: "border-gray-700 bg-gray-900/30 hover:bg-gray-800/50"
											}`}
										>
											<div className="flex items-center gap-2">
												<span className={`text-xs font-bold uppercase ${colorClass}`}>
													{impact.tier}
												</span>
												<span className="text-xs text-gray-400">
													score: {impact.score.toFixed(2)}
												</span>
											</div>
											<p className="text-sm text-gray-300 mt-1 line-clamp-2">{impact.rationale}</p>
											<div className="flex items-center gap-2 mt-2">
												{impact.affected_agents.slice(0, 3).map((agent) => (
													<span
														key={agent}
														className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded"
													>
														{agent.slice(0, 8)}
													</span>
												))}
												{impact.affected_agents.length > 3 && (
													<span className="text-xs text-gray-500">
														+{impact.affected_agents.length - 3} more
													</span>
												)}
											</div>
										</button>
									);
								})
						)}
					</div>
				</div>

				<div className="lg:col-span-2">
					<h2 className="text-lg font-semibold text-white mb-3">Evidence Chain</h2>
					{selectedImpact ? (
						<EvidenceChainDetail
							impact={impacts.find((i) => `${i.target_id}-${i.target_type}` === selectedImpact)}
							events={events}
						/>
					) : (
						<div className="text-center py-12 text-gray-500">
							Select an impact alert to view its evidence chain.
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

function ColibriMetricsPanel({ metrics }: { metrics: ColibriMetrics }) {
	return (
		<div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
			<h3 className="text-lg font-semibold text-white mb-3">Colibri Metrics</h3>
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				<MetricTile label="Model" value={metrics.modelName} />
				<MetricTile label="Vocab Size" value={metrics.vocabSize.toLocaleString()} />
				<MetricTile label="Hidden Size" value={metrics.hiddenSize.toLocaleString()} />
				<MetricTile label="Layers" value={metrics.numLayers.toLocaleString()} />
				<MetricTile label="Heads" value={metrics.numHeads.toLocaleString()} />
				<MetricTile label="Max Seq Len" value={metrics.maxSeqLen.toLocaleString()} />
				<MetricTile label="Tokens Generated" value={metrics.tokensGenerated.toLocaleString()} />
				<MetricTile label="Tokens/sec" value={metrics.tokensPerSecond.toFixed(1)} />
				<MetricTile
					label="Memory"
					value={`${metrics.memoryUsedMB.toFixed(0)}/${metrics.memoryTotalMB.toFixed(0)} MB`}
				/>
			</div>
		</div>
	);
}

function MetricTile({ label, value }: { label: string; value: string }) {
	return (
		<div className="bg-gray-800/30 border border-gray-700 rounded-lg p-3">
			<p className="text-xs text-gray-500">{label}</p>
			<p className="text-sm font-medium text-gray-200">{value}</p>
		</div>
	);
}

function EvidenceChainDetail({
	impact,
	events,
}: {
	impact?: ImpactAnalysis;
	events: PythiaEvent[];
}) {
	if (!impact) return null;

	const relatedEvents = events.filter((e) => impact.affected_agents.includes(e.source_agent));

	return (
		<div className="space-y-4">
			<div className="bg-gray-900/30 border border-gray-700 rounded-lg p-4">
				<h3 className="text-sm font-semibold text-gray-400 mb-2">Root Impact</h3>
				<p className="text-sm text-gray-300">{impact.rationale}</p>
				<div className="flex flex-wrap gap-1 mt-2">
					{impact.mitigations.map((mitigation) => (
						<span key={mitigation} className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded">
							{mitigation}
						</span>
					))}
				</div>
			</div>

			{relatedEvents.length > 0 && (
				<div className="space-y-2">
					<h3 className="text-sm font-semibold text-gray-400">Supporting Events</h3>
					{relatedEvents.map((event) => (
						<div
							key={event.event_id}
							className="bg-gray-800/30 border border-gray-700 rounded-lg p-3"
						>
							<div className="flex items-center justify-between">
								<span className="text-xs text-gray-500">{event.kind}</span>
								<span className="text-xs text-gray-500">
									{new Date(event.timestamp).toLocaleTimeString()}
								</span>
							</div>
							<p className="text-sm text-gray-300 mt-1">{event.title}</p>
							<p className="text-xs text-gray-400 mt-1 line-clamp-2">{event.body.slice(0, 150)}</p>
						</div>
					))}
				</div>
			)}

			<div className="bg-gray-800/30 border border-gray-700 rounded-lg p-3">
				<p className="text-xs text-gray-500">
					Generated by: <span className="text-gray-300">{impact.generated_by}</span>
				</p>
				<p className="text-xs text-gray-500">
					Target: <span className="text-gray-300">{impact.target_type}</span> · ID:{" "}
					<span className="text-gray-300 font-mono text-xs">
						{impact.target_id.slice(0, 16)}...
					</span>
				</p>
			</div>
		</div>
	);
}
