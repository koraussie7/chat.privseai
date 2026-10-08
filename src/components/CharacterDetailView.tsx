import type { CandyCompanion } from "@/data/candyPresets";

interface Props {
	companion: CandyCompanion;
	onClose: () => void;
	onChat?: (companion: CandyCompanion) => void;
	onClone?: (companion: CandyCompanion) => void;
	onRemix?: (companion: CandyCompanion) => void;
	onShare?: (companion: CandyCompanion) => void;
	onGenerateImage?: (companion: CandyCompanion) => void;
}

export function CharacterDetailView({ companion, onClose }: Props) {
	const handleChat = () => {
		window.location.href = `/chat/${encodeURIComponent(companion.id)}`;
	};

	return (
		<div
			className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
			onClick={onClose}
		>
			<div
				className="relative max-w-3xl w-full rounded-3xl border border-white/10 bg-[#0a101b] overflow-hidden mb-8"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="relative h-64 sm:h-80">
					<img
						src={companion.avatarUrl}
						alt={companion.name}
						className="w-full h-full object-cover"
					/>
					<div className="absolute inset-0 bg-gradient-to-t from-[#0a101b] via-transparent to-transparent" />
				</div>

				<div className="p-6 space-y-5">
					<div className="flex items-start justify-between gap-4">
						<div>
							<h2 className="text-2xl font-bold text-white">{companion.name}</h2>
							<div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
								<span>{companion.age} years old</span>
								<span>·</span>
								<span>{companion.occupation}</span>
								<span>·</span>
								<span
									className={
										companion.isOnline
											? "text-emerald-400"
											: "text-gray-500"
									}
								>
									{companion.isOnline ? "Online" : "Offline"}
								</span>
							</div>
						</div>
						<button
							type="button"
							onClick={onClose}
							className="text-gray-500 hover:text-white text-xl w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/5"
						>
							✕
						</button>
					</div>

					<p className="text-sm text-gray-300 leading-relaxed">
						{companion.bio}
					</p>

					{companion.tagline && (
						<div>
							<h3 className="text-xs uppercase tracking-wider text-gray-500 mb-1">Tagline</h3>
							<p className="text-sm text-gray-300 italic">"{companion.tagline}"</p>
						</div>
					)}

					{companion.personality && companion.personality.length > 0 && (
						<div>
							<h3 className="text-xs uppercase tracking-wider text-gray-500 mb-2">
								Personality
							</h3>
							<div className="flex flex-wrap gap-2">
								{companion.personality.map((trait) => (
									<span
										key={trait}
										className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-gray-200"
									>
										{trait}
									</span>
								))}
							</div>
						</div>
					)}

					{companion.hobbies && companion.hobbies.length > 0 && (
						<div>
							<h3 className="text-xs uppercase tracking-wider text-gray-500 mb-2">
								Hobbies & Interests
							</h3>
							<div className="flex flex-wrap gap-2">
								{companion.hobbies.map((hobby) => (
									<span
										key={hobby}
										className="px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-400/20 text-sm text-cyan-200"
									>
										{hobby}
									</span>
								))}
							</div>
						</div>
					)}

					{companion.scenarios && companion.scenarios.length > 0 && (
						<div>
							<h3 className="text-xs uppercase tracking-wider text-gray-500 mb-2">
								Scenarios
							</h3>
							<div className="space-y-2">
								{companion.scenarios.map((scenario) => (
									<div
										key={scenario.id}
										className="p-3 rounded-xl bg-white/[0.03] border border-white/5"
									>
										<div className="flex items-center justify-between">
											<span className="text-sm font-semibold text-white">
												{scenario.title}
											</span>
											{scenario.badge && (
												<span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-300">
													{scenario.badge}
												</span>
											)}
										</div>
										<p className="text-xs text-gray-400 mt-1">
											{scenario.description}
										</p>
									</div>
								))}
							</div>
						</div>
					)}

					{companion.gallery && companion.gallery.length > 0 && (
						<div>
							<h3 className="text-xs uppercase tracking-wider text-gray-500 mb-2">
								Gallery ({companion.gallery.length})
							</h3>
							<div className="grid grid-cols-4 gap-2">
								{companion.gallery.slice(0, 8).map((img) => (
									<img
										key={img.id}
										src={img.url}
										alt={img.title}
										className={`rounded-xl object-cover aspect-[3/4] ${
											img.isUnlocked
												? "opacity-100"
												: "opacity-30 grayscale blur-[1px]"
										}`}
									/>
								))}
							</div>
						</div>
					)}

					<div className="border-t border-white/10 pt-4">
						<div className="mb-3">
							<h3 className="text-xs uppercase tracking-wider text-gray-500 mb-2">
								Model & Memory
							</h3>
							<div className="grid grid-cols-2 gap-3 text-sm">
								<div>
									<span className="text-gray-500">Model:</span>{" "}
									<span className="text-cyan-300">Qwen3-0.6B</span>
								</div>
								<div>
									<span className="text-gray-500">Memory:</span>{" "}
									<span className="text-emerald-300">✓ Enabled</span>
								</div>
								<div>
									<span className="text-gray-500">Voice:</span>{" "}
									<span className="text-purple-300">
										{companion.hasVoice ? "✓ Available" : "✕ Disabled"}
									</span>
								</div>
								<div>
									<span className="text-gray-500">MCP Tools:</span>{" "}
									<span className="text-amber-300">✓ 3 tools</span>
								</div>
							</div>
						</div>

						<div className="flex gap-3">
							<button
								type="button"
								onClick={handleChat}
								className="flex-1 py-2.5 rounded-xl bg-candy-gradient hover:bg-candy-gradient-hover text-white font-bold text-sm shadow-xl shadow-pink-500/20 transition-transform hover:-translate-y-0.5"
							>
								💬 Chat
							</button>
							<button
								type="button"
								onClick={() => {
									const url = `/chat/${encodeURIComponent(companion.id)}`;
									navigator.clipboard.writeText(window.location.origin + url);
								}}
								className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-gray-200 hover:text-white hover:border-cyan-400/50 font-medium text-sm"
								title="Clone"
							>
								📥 Clone
							</button>
							<button
								type="button"
								onClick={() => {
									const url = `/chat/${encodeURIComponent(companion.id)}`;
									navigator.clipboard.writeText(window.location.origin + url);
								}}
								className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-gray-200 hover:text-purple-300 hover:border-purple-400/50 font-medium text-sm"
								title="Remix"
							>
								🔱 Remix
							</button>
							<button
								type="button"
								onClick={() => {
									const link = document.createElement("a");
									link.href = companion.avatarUrl;
									link.download = `${companion.name}-avatar.jpg`;
									link.click();
								}}
								className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-gray-200 hover:text-cyan-300 hover:border-cyan-400/50 font-medium text-sm"
								title="Share via P2P"
							>
								🌐 Share P2P
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
