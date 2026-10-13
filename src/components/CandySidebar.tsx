import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useI18n } from "@/lib/i18n";

interface User {
	id: string;
	email: string;
	name: string;
	picture?: string;
}

interface Props {
	onOpenCreateModal?: () => void;
	peerCount?: number;
	user?: User | null;
	onLogout?: () => void;
}

export function CandySidebar({ onOpenCreateModal, peerCount = 0, user, onLogout }: Props) {
	const [collapsed, setCollapsed] = useState(false);
	const { t, locale, setLocale } = useI18n();
	const localeOptions: ReadonlyArray<{ code: "en" | "ko" | "ja" | "zh" | "my" | "vi"; label: string; flag: string }> = [
		{ code: "en", label: "English", flag: "🇺🇸" },
		{ code: "ko", label: "한국어", flag: "🇰🇷" },
		{ code: "ja", label: "日本語", flag: "🇯🇵" },
		{ code: "zh", label: "中文", flag: "🇨🇳" },
		{ code: "my", label: "မြန်မာ", flag: "🇲" },
		{ code: "vi", label: "Tiếng Việt", flag: "🇻🇳" },
	];


	return (
		<aside
			className={`hidden md:flex flex-col border-r border-white/10 bg-[#0e0f17] transition-all duration-300 z-40 shrink-0 ${
				collapsed ? "w-20" : "w-64"
			}`}
		>
			{/* Logo */}
			<div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
				<NavLink to="/" className="flex items-center gap-3 overflow-hidden">
					<div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 via-rose-500 to-purple-600 flex items-center justify-center font-black text-white text-xl shadow-lg shadow-pink-500/30 shrink-0">
						🍬
					</div>
					{!collapsed && (
						<div className="leading-tight truncate">
							<span className="font-extrabold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-rose-300 to-purple-300 text-lg">
								PRIVSE<span className="text-white">AI</span>
							</span>
							<span className="block text-[10px] tracking-widest text-pink-400 uppercase font-semibold">
								CANDY EDITION
							</span>
						</div>
					)}
				</NavLink>
				<button
					type="button"
					onClick={() => setCollapsed(!collapsed)}
					aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
					className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition hidden lg:block"
				>
					{collapsed ? "»" : "«"}
				</button>
			</div>

			{/* Navigation Links */}
			<div className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
				<CandyNavItem
					to="/"
					icon="🔥"
					label="Discover"
					shortLabel="Discover"
					collapsed={collapsed}
					badge="Hot"
				/>
				<CandyNavItem to="/chat" icon="💬" label="Chat" shortLabel="Chat" collapsed={collapsed} />
				<CandyNavItem
					to="/collection"
					icon="📸"
					label="Gallery & Memories"
					shortLabel="Gallery"
					collapsed={collapsed}
				/>
				<CandyNavItem
					to="/library"
					icon="🗂️"
					label="Character Library"
					shortLabel="Cards"
					collapsed={collapsed}
				/>

				<div className="pt-4 pb-2">
					<div
						className={`px-3 text-[11px] font-bold uppercase tracking-wider text-gray-500 ${
							collapsed ? "hidden" : "block"
						}`}
					>
						Creation & Network
					</div>
				</div>

				<button
					type="button"
					onClick={onOpenCreateModal}
					className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-left font-semibold text-sm transition-all duration-200 group bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20 text-pink-200 hover:from-pink-500/20 hover:to-purple-500/20 hover:border-pink-500/40 ${
						collapsed ? "justify-center" : ""
					}`}
				>
					<span className="text-lg">✨</span>
					{!collapsed && (
						<div className="truncate flex-1">
							<div>Create AI GF</div>
							<div className="text-[10px] text-pink-300/70 font-normal">Custom Waifu</div>
						</div>
					)}
				</button>

				<CandyNavItem to="/hub" icon="🧠" label="AI Hub" shortLabel="Hub" collapsed={collapsed} />
				<CandyNavItem to="/marketplace" icon="🛍️" label={t("marketplace.menu")} shortLabel={t("marketplace.shortMenu")} collapsed={collapsed} badge={t("marketplace.newBadge")} />
				<CandyNavItem to="/integrations" icon="🔌" label="Integrations" shortLabel="Bridge" collapsed={collapsed} />
				<CandyNavItem to="/onboarding/bitterbot" icon="🤖" label="Desktop Bridge (BYOK)" shortLabel="Bitterbot" collapsed={collapsed} />
				<a
					href="https://browserytools.com"
					target="_blank"
					rel="noopener noreferrer"
					title={collapsed ? "Browser Tools" : undefined}
					className={`flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-white/[0.04] transition-all duration-200 ${collapsed ? "justify-center" : ""}`}
				>
					<span className="text-lg shrink-0">🧰</span>
					{!collapsed && <span className="truncate flex-1">Browser Tools</span>}
					{!collapsed && <span className="text-[10px] text-gray-500">↗</span>}
				</a>

				<CandyNavItem
					to="/pricing"
					icon="💎"
					label="Pricing"
					shortLabel="Pricing"
					collapsed={collapsed}
				/>

				<CandyNavItem
					to="/settings"
					icon="⚙️"
					label="Settings"
					shortLabel="Settings"
					collapsed={collapsed}
				/>

				<CandyNavItem
					to="/studio"
					icon="🔬"
					label="Studio"
					shortLabel="Studio"
					collapsed={collapsed}
				/>
				<CandyNavItem
					to="/world"
					icon="🌐"
					label="P2P Mesh Cockpit"
					shortLabel="P2P"
					collapsed={collapsed}
				/>
			</div>

			{/* P2P Status Badge & User Profile */}
			{user ? (
				<div className="p-3 border-t border-white/10 bg-[#0a0b12]">
					<div
						className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 ${
							collapsed ? "justify-center" : ""
						}`}
					>
						<span className="relative flex h-2.5 w-2.5">
							<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
							<span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
						</span>
						{!collapsed && (
							<div className="min-w-0 flex-1">
								<div className="text-xs font-medium text-gray-200">P2P Network Free</div>
								<div className="text-[10px] text-emerald-400 truncate">
									{peerCount > 0 ? `${peerCount} peers linked` : "Decentralized Ready"}
								</div>
							</div>
						)}
					</div>
					{!collapsed && onLogout && (
						<button
							type="button"
							onClick={onLogout}
							className="w-full mt-2 px-3 py-2 rounded-xl text-xs text-rose-300 hover:bg-rose-500/10 transition"
						>
							Sign Out
						</button>
					)}
				</div>
			) : (
				<div className="p-3 border-t border-white/10 bg-[#0a0b12] space-y-2">
					{!collapsed && (
						<div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
							<div className="flex items-center gap-2">
								<span className="text-sm">✨</span>
								<span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
									{t("guest.badge")}
								</span>
							</div>
							<p className="mt-1 text-[10px] leading-relaxed text-slate-400">
								{t("guest.sidebarHint")}
							</p>
							<div className="mt-2 flex flex-wrap gap-1">
								{localeOptions.map((opt) => (
									<button
										key={opt.code}
										type="button"
										onClick={() => setLocale(opt.code)}
										aria-pressed={locale === opt.code}
										className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] transition-colors ${
											locale === opt.code
												? "bg-emerald-500/30 text-emerald-100"
												: "bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]"
										}`}
									>
										<span aria-hidden="true">{opt.flag}</span>
										<span>{opt.label}</span>
									</button>
								))}
							</div>
						</div>
					)}
					<NavLink
						to="/login"
						className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20 text-pink-200 hover:from-pink-500/20 hover:to-purple-500/20 font-semibold text-sm transition-all ${
							collapsed ? "justify-center" : ""
						}`}
					>
						<span className="text-lg">👤</span>
						{!collapsed && <span>{t("common.signIn")}</span>}
					</NavLink>
				</div>
			)}
		</aside>
	);
}

function CandyNavItem({
	to,
	icon,
	label,
	shortLabel,
	collapsed,
	badge,
}: {
	to: string;
	icon: string;
	label: string;
	shortLabel?: string;
	collapsed: boolean;
	badge?: string;
}) {
	return (
		<NavLink
			to={to}
			end={to === "/"}
			className={({ isActive }) =>
				`flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-sm font-medium transition-all duration-200 relative group ${
					isActive
						? "bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-white border border-pink-500/30 shadow-md shadow-pink-500/5 font-semibold"
						: "text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]"
				} ${collapsed ? "justify-center" : ""}`
			}
			title={collapsed ? shortLabel ?? label : undefined}
		>
			<span className="text-lg shrink-0">{icon}</span>
			{!collapsed && <span className="truncate flex-1">{label}</span>}
			{!collapsed && badge && (
				<span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-pink-500 text-white shadow-sm shadow-pink-500/50 uppercase tracking-tight">
					{badge}
				</span>
			)}
		</NavLink>
	);
}
