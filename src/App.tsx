import { useState } from "react";
import { BrowserRouter as Router, Routes, Route, NavLink } from "react-router-dom";
import { CandySidebar } from "@/components/CandySidebar";
import { CandyDiscover } from "@/components/CandyDiscover";
import { CandyCollection } from "@/components/CandyCollection";
import { CandyChatPage } from "@/pages/CandyChatPage";
import { CreateCompanionModal } from "@/components/CreateCompanionModal";
import { WorldCockpit } from "@/components/WorldCockpit";
import { LiveEvents } from "@/components/LiveEvents";
import { ForecastLedger } from "@/components/ForecastLedger";
import { EvidenceExplorer } from "@/components/EvidenceExplorer";
import { ImpactAnalysis } from "@/components/ImpactAnalysis";
import { CANDY_PRESETS, type CandyCompanion } from "@/data/candyPresets";
import { useTrystero } from "@/hooks/useTrysteroP2P";

const STORAGE_CUSTOM = "privseai_candy_custom_companions";

export function App() {
	const [companions, setCompanions] = useState<CandyCompanion[]>(() => {
		const saved = localStorage.getItem(STORAGE_CUSTOM);
		if (saved) {
			try {
				const custom = JSON.parse(saved);
				return [...CANDY_PRESETS, ...custom];
			} catch {
				return CANDY_PRESETS;
			}
		}
		return CANDY_PRESETS;
	});

	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
	const [mobileNavOpen, setMobileNavOpen] = useState(false);
	const { colibriPeers, network } = useTrystero();
	const peerCount = (network?.peers.length ?? 0) + colibriPeers.length;

	const handleCreateCompanion = (newComp: CandyCompanion) => {
		const updated = [newComp, ...companions];
		setCompanions(updated);

		const customOnly = updated.filter(
			(c) => !CANDY_PRESETS.some((preset) => preset.id === c.id),
		);
		localStorage.setItem(STORAGE_CUSTOM, JSON.stringify(customOnly));
	};

	return (
		<Router>
			<div className="flex h-screen w-screen overflow-hidden bg-[#090a0f] text-gray-100 font-sans selection:bg-pink-500 selection:text-white">
				{/* Candy Styled Desktop Sidebar */}
				<CandySidebar
					onOpenCreateModal={() => setIsCreateModalOpen(true)}
					peerCount={peerCount}
				/>

				{/* Main Content Layout */}
				<div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
					{/* Mobile Top Header */}
					<header className="md:hidden flex h-14 items-center justify-between px-4 border-b border-white/10 bg-[#0e0f17] shrink-0 z-30">
						<NavLink to="/" className="flex items-center gap-2">
							<span className="w-8 h-8 rounded-xl bg-candy-gradient flex items-center justify-center text-sm shadow-md shadow-pink-500/20">
								🍬
							</span>
							<span className="font-extrabold text-sm tracking-wide candy-text-gradient">
								PRIVSEAI CANDY
							</span>
						</NavLink>

						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => setIsCreateModalOpen(true)}
								className="px-2.5 py-1 rounded-xl bg-candy-gradient text-xs font-bold text-white shadow-sm"
							>
								+ Create
							</button>
							<button
								type="button"
								onClick={() => setMobileNavOpen((v) => !v)}
								className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-300"
							>
								{mobileNavOpen ? "✕" : "☰"}
							</button>
						</div>
					</header>

					{/* Mobile Drawer Menu */}
					{mobileNavOpen && (
						<div className="md:hidden bg-[#0e0f17] border-b border-white/10 p-4 space-y-2 z-30 shrink-0">
							<NavLink
								to="/"
								onClick={() => setMobileNavOpen(false)}
								className="block px-3 py-2 rounded-xl text-sm font-semibold hover:bg-white/5"
							>
								🔥 Discover
							</NavLink>
							<NavLink
								to="/chat"
								onClick={() => setMobileNavOpen(false)}
								className="block px-3 py-2 rounded-xl text-sm font-semibold hover:bg-white/5"
							>
								💬 Chat
							</NavLink>
							<NavLink
								to="/collection"
								onClick={() => setMobileNavOpen(false)}
								className="block px-3 py-2 rounded-xl text-sm font-semibold hover:bg-white/5"
							>
								📸 Gallery & Memories
							</NavLink>
							<NavLink
								to="/world"
								onClick={() => setMobileNavOpen(false)}
								className="block px-3 py-2 rounded-xl text-sm font-semibold hover:bg-white/5"
							>
								🌐 P2P Mesh Cockpit
							</NavLink>
						</div>
					)}

					{/* Route Screens */}
					<main className="flex-1 flex min-h-0 w-full overflow-hidden relative">
						<Routes>
							<Route
								path="/"
								element={
									<CandyDiscover
										companions={companions}
										onOpenCreate={() => setIsCreateModalOpen(true)}
									/>
								}
							/>
							<Route path="/chat" element={<CandyChatPage />} />
							<Route path="/chat/:companionId" element={<CandyChatPage />} />
							<Route
								path="/collection"
								element={<CandyCollection companions={companions} />}
							/>
							{/* Preserve original P2P utility routes for ecosystem compatibility */}
							<Route path="/world" element={<WorldCockpit />} />
							<Route path="/events" element={<LiveEvents />} />
							<Route path="/forecasts" element={<ForecastLedger />} />
							<Route path="/evidence" element={<EvidenceExplorer />} />
							<Route path="/impact" element={<ImpactAnalysis />} />
							<Route path="*" element={<CandyChatPage />} />
						</Routes>
					</main>
				</div>

				{/* Create Character Modal */}
				<CreateCompanionModal
					isOpen={isCreateModalOpen}
					onClose={() => setIsCreateModalOpen(false)}
					onCreate={handleCreateCompanion}
				/>
			</div>
		</Router>
	);
}

