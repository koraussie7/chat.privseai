import { useColibri } from "@/hooks/useTrysteroP2P";
import type { PythiaForecast } from "@/types/pythia";
import { useCallback, useState } from "react";

export function ForecastLedger() {
	const { models, generate, loading } = useColibri();
	const [modelCid, setModelCid] = useState("bafyreibglm52");
	const [prompt, setPrompt] = useState("");
	const [result, setResult] = useState<string | null>(null);
	const [forecasts, setForecasts] = useState<PythiaForecast[]>([
		{
			forecast_id: "fc-001",
			agent_id: "pythia-research-7",
			created_at: new Date().toISOString(),
			hypothesis: "Q4 hardware demand for LLM training will increase 15%",
			outcome: "Confirmed: 17.2% increase in GPU orders",
			confidence: "high",
			confidence_numeric: 0.82,
			horizon: "90 days",
			supporting_events: ["evt-101", "evt-102"],
			citations: ["https://example.com/report-2026-q3"],
			localcrab_claim_id: "claim-8821",
		},
		{
			forecast_id: "fc-002",
			agent_id: "pythia-research-3",
			created_at: new Date(Date.now() - 3600000).toISOString(),
			hypothesis: "Nostr relay adoption among P2P apps will surpass 500 nodes by Nov 2026",
			outcome: "Pending — current count: 427 nodes",
			confidence: "medium",
			confidence_numeric: 0.55,
			horizon: "30 days",
			supporting_events: ["evt-201"],
			citations: [],
			localcrab_claim_id: null,
		},
	]);

	const handleGenerate = useCallback(async () => {
		if (!prompt.trim()) return;
		const res = await generate(modelCid, prompt, { maxTokens: 512, temperature: 0.7 });
		if (res) {
			const content = res.choices[0]?.message?.content ?? "[no output]";
			setResult(content);

			const newForecast: PythiaForecast = {
				forecast_id: `fc-${Date.now()}`,
				agent_id: "privseai-colibri",
				created_at: new Date().toISOString(),
				hypothesis: prompt.slice(0, 100),
				outcome: content.slice(0, 200),
				confidence: "medium",
				confidence_numeric: 0.5,
				horizon: "pending",
				supporting_events: [],
				citations: [],
				localcrab_claim_id: null,
			};
			setForecasts((prev) => [newForecast, ...prev]);
		}
	}, [modelCid, prompt, generate]);

	return (
		<div className="space-y-6 p-6">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold text-white">Forecast Ledger</h1>
				<span className="text-sm text-gray-400">{forecasts.length} claims tracked</span>
			</div>

			<div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
				<h2 className="text-lg font-semibold text-white mb-3">Colibri Inference</h2>
				<div className="space-y-3">
					<div>
						<label htmlFor="model-cid" className="text-xs text-gray-400">
							Model CID
						</label>
						<select
							id="model-cid"
							value={modelCid}
							onChange={(e) => setModelCid(e.target.value)}
							className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm"
						>
							{models.length > 0
								? models.map((m) => (
										<option key={m.cid} value={m.cid}>
											{m.name} ({m.cid.slice(0, 6)}...)
										</option>
									))
								: "bafyreibglm52"}
							<option value="bafyreibglm52">GLM-5.2 744B (default)</option>
							<option value="bafyreibkimi-k3">Kimi K3 1.6T</option>
						</select>
					</div>
					<div>
						<label htmlFor="inference-prompt" className="text-xs text-gray-400">
							Prompt
						</label>
						<textarea
							id="inference-prompt"
							value={prompt}
							onChange={(e) => setPrompt(e.target.value)}
							placeholder="Enter your prompt for Colibri WASM inference..."
							className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 placeholder-gray-500 text-sm resize-y min-h-[80px]"
							disabled={loading}
						/>
					</div>
					<button
						type="button"
						onClick={handleGenerate}
						disabled={loading || !prompt.trim()}
						className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
					>
						{loading ? "Generating..." : "Generate with Colibri"}
					</button>
				</div>
			</div>

			{result && (
				<div className="bg-gray-900/30 border border-gray-700 rounded-lg p-4">
					<p className="text-xs text-gray-500 mb-2">Inference Result</p>
					<pre className="text-sm text-gray-300 whitespace-pre-wrap overflow-x-auto">{result}</pre>
				</div>
			)}

			<div className="space-y-3">
				{forecasts.map((f) => (
					<ForecastCard key={f.forecast_id} forecast={f} />
				))}
			</div>
		</div>
	);
}

function ForecastCard({ forecast }: { forecast: PythiaForecast }) {
	const tierLabels: Record<NonNullable<PythiaForecast["confidence"]>, string> = {
		low: "Low",
		medium: "Medium",
		high: "High",
		certain: "Certain",
	};

	return (
		<div className="bg-gray-900/30 border border-gray-700 rounded-lg p-4">
			<div className="flex items-start justify-between mb-2">
				<div className="flex items-center gap-2">
					<span
						className={`text-xs px-2 py-1 rounded ${
							forecast.confidence === "high" || forecast.confidence === "certain"
								? "bg-green-500/20 text-green-400"
								: forecast.confidence === "medium"
									? "bg-amber-500/20 text-amber-400"
									: "bg-gray-500/20 text-gray-400"
						}`}
					>
						{tierLabels[forecast.confidence]}
					</span>
					<span className="text-xs text-gray-500">
						{forecast.confidence_numeric !== null && forecast.confidence_numeric !== undefined
							? `${Math.round(forecast.confidence_numeric * 100)}%`
							: "N/A"}
					</span>
				</div>
				<span className="text-xs text-gray-500">
					{new Date(forecast.created_at).toLocaleTimeString()}
				</span>
			</div>
			<p className="text-sm text-gray-300">{forecast.hypothesis}</p>
			<p className="text-xs text-gray-500 mt-1">→ {forecast.outcome}</p>
			{forecast.citations.length > 0 && (
				<div className="mt-2">
					<p className="text-xs text-gray-500">Citations:</p>
					<ul className="text-xs text-gray-400 list-disc list-inside">
						{forecast.citations.map((citation) => (
							<li key={citation}>{citation}</li>
						))}
					</ul>
				</div>
			)}
			<div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
				<span>Agent: {forecast.agent_id}</span>
				<span>Horizon: {forecast.horizon ?? "—"}</span>
				{forecast.localcrab_claim_id && (
					<span>Claim: {forecast.localcrab_claim_id.slice(0, 8)}...</span>
				)}
			</div>
		</div>
	);
}
