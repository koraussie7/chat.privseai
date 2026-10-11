import { EvidenceExplorer } from "@/components/EvidenceExplorer";
import { ForecastLedger } from "@/components/ForecastLedger";
import { ImpactAnalysis } from "@/components/ImpactAnalysis";
import { LiveEvents } from "@/components/LiveEvents";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";

type Tab = "events" | "evidence" | "forecasts" | "impact";

const TABS: { id: Tab; label: string; hint: string }[] = [
	{ id: "events", label: "Live Events", hint: "Mesh event stream" },
	{ id: "evidence", label: "Evidence", hint: "IPFS evidence ledger" },
	{ id: "forecasts", label: "Forecasts", hint: "Agent hypothesis ledger" },
	{ id: "impact", label: "Impact", hint: "Blast-radius analysis" },
];

/**
 * Studio — the analysis workspace.
 *
 * LiveEvents, EvidenceExplorer, ForecastLedger and ImpactAnalysis were all
 * routed (/events, /evidence, /forecasts, /impact) but nothing linked to them:
 * the sidebar had no entries, so the only way in was typing the URL by hand,
 * and there was no shared shell for moving between them. This page gives the
 * four a single entry point and a tab bar to switch.
 *
 * Each panel keeps its own `<AuthGate>` wrapper, so an unauthenticated visitor
 * lands on the page and is prompted per-tab rather than being bounced away.
 */
export function StudioPage() {
	const [tab, setTab] = useState<Tab>("events");
	const { isAuthenticated } = useAuth();

	return (
		<div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
			<header className="mb-6">
				<h1 className="text-2xl font-bold text-white sm:text-3xl">Studio</h1>
				<p className="mt-1 text-sm text-gray-400">
					Forecast, evidence and impact analysis across the P2P mesh.
				</p>
			</header>

			{!isAuthenticated && (
				<div className="mb-5 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-xs text-amber-200/90">
					Sign in to read the mesh ledgers. Panels below ask for access individually.
				</div>
			)}

			<div
				role="tablist"
				aria-label="Studio sections"
				className="mb-6 flex flex-wrap gap-2 border-b border-white/10 pb-3"
			>
				{TABS.map((t) => {
					const active = tab === t.id;
					return (
						<button
							key={t.id}
							type="button"
							role="tab"
							id={`studio-tab-${t.id}`}
							aria-selected={active}
							aria-controls={`studio-panel-${t.id}`}
							title={t.hint}
							onClick={() => setTab(t.id)}
							className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
								active
									? "bg-pink-500/15 text-pink-200 ring-1 ring-pink-500/30"
									: "text-gray-400 hover:bg-white/[0.04] hover:text-gray-200"
							}`}
						>
							{t.label}
						</button>
					);
				})}
			</div>

			<div
				role="tabpanel"
				id={`studio-panel-${tab}`}
				aria-labelledby={`studio-tab-${tab}`}
				className="min-h-[420px]"
			>
				{tab === "events" && <LiveEvents />}
				{tab === "evidence" && <EvidenceExplorer />}
				{tab === "forecasts" && <ForecastLedger />}
				{tab === "impact" && <ImpactAnalysis />}
			</div>
		</div>
	);
}
