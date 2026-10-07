import { EvidenceExplorer } from "@/components/EvidenceExplorer";
import { ForecastLedger } from "@/components/ForecastLedger";
import { ImpactAnalysis } from "@/components/ImpactAnalysis";
import { LiveEvents } from "@/components/LiveEvents";
import { WorldCockpit } from "@/components/WorldCockpit";
import { ChatPage } from "@/pages/ChatPage";
import { useState } from "react";
import { NavLink, Route, BrowserRouter as Router, Routes } from "react-router-dom";

const navigation = [
	{ to: "/", label: "Chat", shortLabel: "Chat" },
	{ to: "/world", label: "World Cockpit", shortLabel: "World" },
	{ to: "/events", label: "Live Events", shortLabel: "Events" },
	{ to: "/forecasts", label: "Forecast Ledger", shortLabel: "Forecasts" },
	{ to: "/evidence", label: "Evidence Explorer", shortLabel: "Evidence" },
	{ to: "/impact", label: "Impact Analysis", shortLabel: "Impact" },
];

export function App() {
	const [menuOpen, setMenuOpen] = useState(false);
	return (
		<Router>
			<div className="min-h-screen bg-[#070b13] text-gray-100">
				<nav className="sticky top-0 z-50 border-b border-white/10 bg-[#070b13]/90 shadow-lg shadow-black/20 backdrop-blur-xl">
					<div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
						<div className="flex h-[72px] items-center justify-between gap-4">
							<NavLink
								to="/"
								className="flex shrink-0 items-center gap-3"
								aria-label="PrivseAI home"
							>
								<span className="flex h-10 w-10 items-center justify-center rounded-xl border-cyan-300/20 bg-cyan-300/10 text-lg font-black text-cyan-200">
									P
								</span>
								<span className="leading-tight">
									<span className="block text-sm font-semibold tracking-wide text-white">
										PRIVSEAI
									</span>
									<span className="block text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
										P2P Companion
									</span>
								</span>
							</NavLink>
							<div className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
								{navigation.map((item) => (
									<NavItem key={item.to} to={item.to} label={item.label} />
								))}
							</div>
							<div className="hidden items-center gap-2 sm:flex">
								<span className="flex items-center gap-2 rounded-full border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-1.5 text-[11px] font-medium text-emerald-200/80">
									<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" /> Mesh ready
								</span>
							</div>
							<button
								type="button"
								className="inline-flex h-10 w-10 items-center justify-center rounded-xl border-white/10 text-slate-300 hover:bg-white/5 lg:hidden"
								aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
								aria-expanded={menuOpen}
								onClick={() => setMenuOpen((open) => !open)}
							>
								<span className="text-xl leading-none" aria-hidden="true">
									{menuOpen ? "×" : "☰"}
								</span>
							</button>
						</div>
						{menuOpen && (
							<div
								className="grid gap-1 border-t border-white/10 py-3 lg:hidden"
								aria-label="Mobile navigation"
							>
								{navigation.map((item) => (
									<NavItem
										key={item.to}
										to={item.to}
										label={item.shortLabel}
										onNavigate={() => setMenuOpen(false)}
									/>
								))}
							</div>
						)}
					</div>
				</nav>
				<main>
					<Routes>
						<Route path="/" element={<ChatPage />} />
						<Route path="/chat/:companionId" element={<ChatPage />} />
						<Route path="/world" element={<WorldCockpit />} />
						<Route path="/events" element={<LiveEvents />} />
						<Route path="/forecasts" element={<ForecastLedger />} />
						<Route path="/evidence" element={<EvidenceExplorer />} />
						<Route path="/impact" element={<ImpactAnalysis />} />
						<Route path="*" element={<ChatPage />} />
					</Routes>
				</main>
			</div>
		</Router>
	);
}

function NavItem({
	to,
	label,
	onNavigate,
}: { to: string; label: string; onNavigate?: () => void }) {
	return (
		<NavLink
			end={to === "/"}
			onClick={onNavigate}
			to={to}
			className={({ isActive }) =>
				`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
					isActive
						? "bg-blue-600 text-white"
						: "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
				}`
			}
		>
			{label}
		</NavLink>
	);
}
