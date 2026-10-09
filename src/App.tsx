import { AuthGate } from "@/components/AuthGate";
import { RequireAuth } from "@/components/RequireAuth";
import { CandyCollection } from "@/components/CandyCollection";
import { CandyDiscover } from "@/components/CandyDiscover";
import { CandySidebar } from "@/components/CandySidebar";
import { CreateCompanionModal } from "@/components/CreateCompanionModal";
import { EvidenceExplorer } from "@/components/EvidenceExplorer";
import { ForecastLedger } from "@/components/ForecastLedger";
import { ImpactAnalysis } from "@/components/ImpactAnalysis";
import { LiveEvents } from "@/components/LiveEvents";
import { WorldCockpit } from "@/components/WorldCockpit";
import { CANDY_PRESETS, loadAllCandyPresets, type CandyCompanion } from "@/data/candyPresets";
import { useAuth } from "@/hooks/useAuth";
import { useTrystero } from "@/hooks/useTrysteroP2P";
import { AIHubPage } from "@/pages/AIHubPage";
import { APIKeysPage } from "@/pages/APIKeysPage";
import { AccountSettingsPage } from "@/pages/AccountSettingsPage";
import { CandyChatPage } from "@/pages/CandyChatPage";
import { LoginPage } from "@/pages/LoginPage";
import { PricingPage } from "@/pages/PricingPage";
import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";

const STORAGE_CUSTOM = "privseai_candy-custom_companions";

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

	// Lazily load the full 100-entry preset list on mount so the JSON
	// chunk stays out of the initial bundle. The eager CANDY_PRESETS
	// (6 featured entries) is rendered immediately, then this effect
	// swaps in the full list a moment later.
	useEffect(() => {
		let cancelled = false;
		loadAllCandyPresets().then((all) => {
			if (cancelled) return;
			setCompanions((current) => {
				const known = new Set(current.map((c) => c.id));
				const merged = [...current, ...all.filter((p) => !known.has(p.id))];
				return merged;
			});
		});
		// Preload IndexedDB-cached images so the next AIHubPage mount
		// can restore previously generated portraits without waiting
		// for the first ComfyUI round-trip.
		void import("@/lib/image-cache").then(({ getAllCachedImages }) =>
			getAllCachedImages().catch(() => []),
		);
		return () => {
			cancelled = true;
		};
	}, []);

	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
	const [editingCompanion, setEditingCompanion] = useState<CandyCompanion | null>(null);
	const [mobileNavOpen, setMobileNavOpen] = useState(false);

	const isCustomCompanion = (companion: CandyCompanion) =>
		!CANDY_PRESETS.some((preset) => preset.id === companion.id);

	const persistCustomCompanions = (list: CandyCompanion[]) => {
		const customOnly = list.filter((c) => isCustomCompanion(c));
		localStorage.setItem(STORAGE_CUSTOM, JSON.stringify(customOnly));
	};
	useEffect(() => {
		try {
			const progress = JSON.parse(
				localStorage.getItem("privseai_candy_relationship_progress") || "{}",
			) as Record<string, { stage?: number }>;
			setCompanions((current) =>
				current.map((companion) => {
					const stage = Math.max(companion.stage, progress[companion.id]?.stage ?? 0);
					return {
						...companion,
						stage,
						gallery: companion.gallery.map((photo) => ({
							...photo,
							isUnlocked: photo.isUnlocked || (photo.requiredStage ?? 0) <= stage,
						})),
					};
				}),
			);
		} catch {
			localStorage.removeItem("privseai_candy_relationship_progress");
		}
	}, []);

	const { colibriPeers, network } = useTrystero();
	const peerCount = (network?.peers.length ?? 0) + colibriPeers.length;
	const { user, logout } = useAuth();

	const handleCreateCompanion = (newComp: CandyCompanion) => {
		const updated = [newComp, ...companions];
		setCompanions(updated);
		persistCustomCompanions(updated);
	};

	const handleUpdateCompanion = (updatedComp: CandyCompanion) => {
		const updated = companions.map((c) => (c.id === updatedComp.id ? updatedComp : c));
		setCompanions(updated);
		persistCustomCompanions(updated);
	};

	const handleDeleteCompanion = (id: string) => {
		const target = companions.find((c) => c.id === id);
		if (!target || !isCustomCompanion(target)) return;
		if (!window.confirm(`"${target.name}" 캐릭터를 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) {
			return;
		}
		const updated = companions.filter((c) => c.id !== id);
		setCompanions(updated);
		persistCustomCompanions(updated);
	};

	const goHome = () => {
		window.location.href = "/";
	};
	const goSettings = () => {
		window.location.href = "/settings";
	};

	return (
		<Router>
			<div className="flex h-screen w-screen overflow-hidden bg-[#090a0f] text-gray-100 font-sans selection:bg-pink-500 selection:text-white">
				{/* Candy Styled Desktop Sidebar */}
				<CandySidebar
					onOpenCreateModal={() => setIsCreateModalOpen(true)}
					peerCount={peerCount}
					user={user}
					onLogout={() => {
						logout();
						window.location.href = "/login";
					}}
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
								to="/hub"
								onClick={() => setMobileNavOpen(false)}
								className="block px-3 py-2 rounded-xl text-sm font-semibold hover:bg-white/5"
							>
								🧠 AI Hub
							</NavLink>
							<NavLink
								to="/pricing"
								onClick={() => setMobileNavOpen(false)}
								className="block px-3 py-2 rounded-xl text-sm font-semibold hover:bg-white/5"
							>
								💎 Pricing
							</NavLink>
						</div>
					)}

					{/* Route Screens */}
					<main className="flex-1 flex min-h-0 w-full overflow-hidden relative">
						<Routes>
							<Route
								path="/login"
								element={<LoginPage onAuthSuccess={() => window.location.reload()} />}
							/>
							<Route
								index
								element={
									<AuthGate>
										<CandyDiscover
											companions={companions}
											onOpenCreate={() => setIsCreateModalOpen(true)}
										/>
									</AuthGate>
								}
							/>
							<Route
								path="/chat"
								element={
									<AuthGate>
										<CandyChatPage />
									</AuthGate>
								}
							/>
							<Route
								path="/chat/:companionId"
								element={
									<AuthGate>
										<CandyChatPage />
									</AuthGate>
								}
							/>
							<Route
								path="/collection"
								element={
									<AuthGate>
										<CandyCollection
											companions={companions}
											onEdit={setEditingCompanion}
											onDelete={handleDeleteCompanion}
										/>
									</AuthGate>
								}
							/>
							{/* Preserve original P2P utility routes for ecosystem compatibility */}
							<Route
								path="/world"
								element={
									<AuthGate>
										<WorldCockpit />
									</AuthGate>
								}
							/>
							<Route
								path="/hub"
								element={
									<AuthGate>
										<AIHubPage />
									</AuthGate>
								}
							/>
							<Route
								path="/events"
								element={
									<AuthGate>
										<LiveEvents />
									</AuthGate>
								}
							/>
							<Route
								path="/forecasts"
								element={
									<AuthGate>
										<ForecastLedger />
									</AuthGate>
								}
							/>
							<Route
								path="/evidence"
								element={
									<AuthGate>
										<EvidenceExplorer />
									</AuthGate>
								}
							/>
							<Route
								path="/impact"
								element={
									<AuthGate>
										<ImpactAnalysis />
									</AuthGate>
								}
							/>
							<Route path="/pricing" element={<PricingPage onBack={goHome} />} />
							<Route
								path="/settings"
								element={
									<RequireAuth>
										<AccountSettingsPage onBack={goHome} />
									</RequireAuth>
								}
							/>
							<Route
								path="/settings/api-keys"
								element={
									<RequireAuth>
										<APIKeysPage onBack={goSettings} />
									</RequireAuth>
								}
							/>
							<Route path="*" element={<Navigate to="/collection" replace />} />
						</Routes>
					</main>
				</div>

				{/* Create / Edit Character Modal */}
				<CreateCompanionModal
					isOpen={isCreateModalOpen || editingCompanion !== null}
					editingCompanion={editingCompanion}
					onClose={() => {
						setIsCreateModalOpen(false);
						setEditingCompanion(null);
					}}
					onCreate={handleCreateCompanion}
					onUpdate={handleUpdateCompanion}
				/>
			</div>
		</Router>
	);
}
