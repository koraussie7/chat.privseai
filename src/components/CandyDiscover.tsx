import type { CandyCompanion } from "@/data/candyPresets";
import { useAIHub } from "@/hooks/useAIHub";
import { CharacterCardParser } from "@/lib/character-card";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface Props {
	companions: CandyCompanion[];
	onOpenCreate: () => void;
}

export function CandyDiscover({ companions, onOpenCreate }: Props) {
	const [activeCategory, setActiveCategory] = useState<"all" | "realistic" | "anime">("all");
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedTag, setSelectedTag] = useState<string>("all");
	const navigate = useNavigate();
	const aiHub = useAIHub();

	const handleShareToP2P = (comp: CandyCompanion) => {
		const card = {
			spec: "chara_card_v2" as const,
			data: CharacterCardParser.profileToCard({
				id: comp.id,
				name: comp.name,
				age: comp.age,
				avatarUrl: comp.avatarUrl,
				gallery: comp.gallery?.map((g) => g.url) ?? [],
				bio: comp.bio,
				relationship: comp.relationship,
				occupation: comp.occupation,
				hobbies: comp.hobbies,
				personality: comp.personality,
				stage: comp.stage,
			}),
		};

		const pkg = aiHub.createPackage({
			card,
			description: comp.tagline,
			creator: "You",
			baseModel: "Qwen3-0.6B",
			category: comp.category,
			tags: [...(comp.hobbies || []), ...(comp.personality || [])],
			media: {
				avatarUrl: comp.avatarUrl,
				bannerUrl: comp.bannerUrl,
				gallery: comp.gallery?.map((g) => g.url) ?? [],
			},
		});

		aiHub.sharePackage(pkg).then((result) => {
			if (result.success) {
				alert(`Shared ${pkg.metadata.name} to P2P network! 🧠`);
			} else {
				alert(`Share failed: ${result.error}`);
			}
		});
	};

	const filteredCompanions = companions.filter((comp) => {
		if (activeCategory !== "all" && comp.category !== activeCategory) {
			return false;
		}
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			const matchName = comp.name.toLowerCase().includes(q);
			const matchBio = comp.bio.toLowerCase().includes(q);
			const matchTag = comp.personality.some((p) => p.toLowerCase().includes(q));
			if (!matchName && !matchBio && !matchTag) return false;
		}
		if (selectedTag !== "all") {
			if (!comp.personality.includes(selectedTag)) return false;
		}
		return true;
	});

	const tags = ["all", "Warm", "Sensual", "Tsundere", "Playful", "Confident", "Romantic"];

	return (
		<div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto w-full">
			{/* Top Hero / Banner */}
			<div className="relative rounded-3xl overflow-hidden mb-8 border border-white/10 bg-gradient-to-r from-pink-950/40 via-purple-950/30 to-[#0e1017] p-6 sm:p-10 shadow-2xl">
				<div className="absolute top-0 right-0 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
				<div className="relative z-10 max-w-2xl">
					<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/20 border border-pink-500/30 text-pink-300 text-xs font-semibold mb-4">
						<span>✨</span> Next-Gen P2P Free Companion
					</div>
					<h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
						Connect with Your Ideal <br />
						<span className="candy-text-gradient">AI Girlfriend</span>
					</h1>
					<p className="mt-3 text-sm sm:text-base text-gray-300 max-w-xl leading-relaxed">
						현실적인 실사 모델부터 애니메 와이프까지, 완전한 프라이버시와 무제한 P2P 무료 대화를
						즐겨보세요. 음성 메시지, 셀카 사진 요청, 커스텀 롤플레잉까지 지원합니다.
					</p>

					<div className="mt-6 flex flex-wrap gap-3">
						<button
							type="button"
							onClick={onOpenCreate}
							className="px-6 py-3 rounded-2xl bg-candy-gradient hover:bg-candy-gradient-hover text-white font-bold text-sm shadow-lg shadow-pink-500/25 transition-all transform hover:-translate-y-0.5"
						>
							+ Create Custom Character
						</button>
						<button
							type="button"
							onClick={() => navigate("/hub")}
							className="px-6 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm border border-white/10 transition-all flex items-center gap-2"
						>
							🧠 AI Hub
						</button>
						<button
							type="button"
							onClick={() => navigate("/chat/luna")}
							className="px-6 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm border border-white/10 transition-all"
						>
							Chat with Luna (Featured)
						</button>
					</div>
				</div>
			</div>

			{/* Filter Tabs & Search Bar */}
			<div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
				{/* Category Pills */}
				<div className="flex items-center gap-2 p-1 bg-[#13141f] rounded-2xl border border-white/10 self-start sm:self-auto">
					<button
						type="button"
						onClick={() => setActiveCategory("all")}
						className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
							activeCategory === "all"
								? "bg-candy-gradient text-white shadow-md shadow-pink-500/20"
								: "text-gray-400 hover:text-white"
						}`}
					>
						✨ All Companions
					</button>
					<button
						type="button"
						onClick={() => setActiveCategory("realistic")}
						className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
							activeCategory === "realistic"
								? "bg-candy-gradient text-white shadow-md shadow-pink-500/20"
								: "text-gray-400 hover:text-white"
						}`}
					>
						💃 Realistic
					</button>
					<button
						type="button"
						onClick={() => setActiveCategory("anime")}
						className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
							activeCategory === "anime"
								? "bg-candy-gradient text-white shadow-md shadow-pink-500/20"
								: "text-gray-400 hover:text-white"
						}`}
					>
						🌸 Anime
					</button>
				</div>

				{/* Search Input */}
				<div className="relative w-full sm:w-72">
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Search personality, name..."
						className="w-full bg-[#13141f] border border-white/10 rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-pink-500/50"
					/>
					{searchQuery && (
						<button
							type="button"
							onClick={() => setSearchQuery("")}
							className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs"
						>
							✕
						</button>
					)}
				</div>
			</div>

			{/* Personality Sub-tags */}
			<div className="flex items-center gap-2 overflow-x-auto pb-4 mb-4 scrollbar-none">
				{tags.map((tag) => (
					<button
						key={tag}
						type="button"
						onClick={() => setSelectedTag(tag)}
						className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
							selectedTag === tag
								? "bg-pink-500/20 border border-pink-500/50 text-pink-300"
								: "bg-white/[0.03] border border-white/5 text-gray-400 hover:text-gray-200 hover:bg-white/[0.07]"
						}`}
					>
						{tag === "all" ? "🔥 Trending All" : `#${tag}`}
					</button>
				))}
			</div>

			{/* Character Grid */}
			<div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
				{filteredCompanions.map((comp) => (
					<div
						key={comp.id}
						onClick={() => navigate(`/chat/${comp.id}`)}
						className="group relative cursor-pointer rounded-3xl overflow-hidden border border-white/10 bg-[#12141e] hover:border-pink-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-pink-500/10 flex flex-col"
					>
						{/* Image Aspect Ratio 3:4 */}
						<div className="relative aspect-[3/4] overflow-hidden bg-gray-900">
							<img
								src={comp.avatarUrl}
								alt={comp.name}
								className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
								loading="lazy"
							/>
							<div className="absolute inset-0 bg-gradient-to-t from-[#0e0f17] via-[#0e0f17]/20 to-transparent opacity-90 group-hover:opacity-80 transition-opacity" />

							{/* Badges Overlay */}
							<div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
								{comp.isOnline && (
									<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-medium text-emerald-400">
										<span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
										Online
									</span>
								)}
								{comp.hasVoice && (
									<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-900/60 backdrop-blur-md border border-purple-400/30 text-[10px] font-semibold text-purple-200">
										🎙️ Voice
									</span>
								)}
							</div>

							<div className="absolute top-3 right-3 z-10">
								<span className="px-2 py-0.5 rounded-full bg-pink-500/70 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider">
									{comp.category}
								</span>
							</div>

							{/* Floating Chat Quick-action */}
							<div className="absolute inset-x-4 bottom-4 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-200 z-20 flex gap-2">
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										navigate(`/chat/${comp.id}`);
									}}
									className="flex-1 py-2.5 rounded-xl bg-candy-gradient text-white text-xs font-bold shadow-lg shadow-pink-500/30 flex items-center justify-center gap-1.5"
								>
									<span>💬</span> Start Chatting
								</button>
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										handleShareToP2P(comp);
									}}
									title="Share to P2P network"
									className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white text-xs border border-white/10 transition"
								>
									🌐
								</button>
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										navigate("/hub");
									}}
									title="View in AI Hub"
									className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white text-xs border border-white/10 transition"
								>
									🧠
								</button>
							</div>
						</div>

						{/* Character Metadata */}
						<div className="p-4 flex-1 flex flex-col justify-between">
							<div>
								<div className="flex items-center justify-between gap-1 mb-1">
									<h2 className="text-base font-bold text-white group-hover:text-pink-300 transition-colors truncate">
										{comp.name},{" "}
										<span className="font-normal text-gray-400 text-sm">{comp.age}</span>
									</h2>
									<span className="text-xs text-yellow-400 font-semibold">★ 4.9</span>
								</div>
								<p className="text-xs text-gray-400 line-clamp-2 leading-relaxed mb-3">
									{comp.tagline || comp.bio}
								</p>
							</div>

							<div className="flex flex-wrap gap-1.5">
								{comp.personality.slice(0, 3).map((trait) => (
									<span
										key={trait}
										className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white/[0.04] text-gray-300 border border-white/5"
									>
										{trait}
									</span>
								))}
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
