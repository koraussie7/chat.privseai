import { CharacterCardParser } from "@/lib/character-card";
import type { CharacterCard } from "@/types/character";
import type { CompanionProfile } from "./CompanionChat";

interface Props {
	cards: CharacterCard[];
	onSelect: (profile: CompanionProfile) => void;
	onDelete?: (id: string) => void;
}

export function CharacterGallery({ cards, onSelect, onDelete }: Props) {
	if (cards.length === 0) {
		return (
			<div className="text-center py-8 text-sm text-gray-500">
				<span className="text-2xl mb-2 block">📁</span>
				No characters imported yet.
				<br />
				Use the uploader to add character cards.
			</div>
		);
	}

	return (
		<div className="grid grid-cols-2 gap-3">
			{cards.map((card) => {
				const profile = CharacterCardParser.cardToProfile(card);

				return (
					<button
						key={card.data.name}
						type="button"
						onClick={() => onSelect(profile)}
						className="group relative flex flex-col rounded-xl border border-white/10 bg-white/[0.02] p-2 text-left transition hover:border-cyan-400/40 hover:bg-white/[0.04]"
					>
						<div className="aspect-[3/4] rounded-lg overflow-hidden bg-gray-800 mb-2">
							{profile.avatarUrl ? (
								<img
									src={profile.avatarUrl}
									alt={profile.name}
									className="h-full w-full object-cover"
								/>
							) : (
								<div className="h-full w-full flex items-center justify-center text-gray-500">
									No image
								</div>
							)}
						</div>
						<div className="min-w-0">
							<div className="font-medium text-sm truncate">{card.data.name}</div>
							{card.data.tags?.length ? (
								<div className="mt-1 flex flex-wrap gap-1">
									{card.data.tags.slice(0, 3).map((tag) => (
										<span
											key={tag}
											className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400 truncate"
										>
											{tag}
										</span>
									))}
								</div>
							) : null}
						</div>
						{onDelete && (
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									onDelete(card.data.name);
								}}
								className="absolute top-1 right-1 rounded opacity-0 group-hover:opacity-100 transition"
								title="Remove character"
							>
								✕
							</button>
						)}
					</button>
				);
			})}
		</div>
	);
}

