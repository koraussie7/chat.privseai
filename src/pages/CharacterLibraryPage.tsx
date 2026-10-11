import { CharacterGallery } from "@/components/CharacterGallery";
import { CharacterCardUploader } from "@/components/CharacterCardUploader";
import type { CharacterCard, ParsedCharacterCard } from "@/types/character";
import { useState } from "react";
import type { CompanionProfile } from "@/components/CompanionChat";

const STORAGE_KEY = "privseai_companion_cards";

function loadCards(): CharacterCard[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? (parsed as CharacterCard[]) : [];
	} catch {
		return [];
	}
}

function saveCards(cards: CharacterCard[]): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
	} catch {
		// Storage full or blocked (private mode) — the in-memory list still works
		// for this session, so don't surface an error over it.
	}
}

/**
 * CharacterLibrary — import and manage character cards.
 *
 * `CharacterGallery` was written but never mounted: ChatPage rendered its own
 * inline list instead, and the gallery's select/delete affordances were
 * unreachable. This page gives the pair (uploader + gallery) a home and shares
 * the same `privseai_companion_cards` key ChatPage reads, so imports made here
 * show up as selectable companions in Chat.
 */
export function CharacterLibraryPage() {
	const [cards, setCards] = useState<CharacterCard[]>(() => loadCards());
	const [notice, setNotice] = useState<string | null>(null);

	const handleImport = (parsed: ParsedCharacterCard) => {
		setCards((prev) => {
			// Guard against double-importing the same card (name is the identity
			// CharacterGallery keys on).
			if (prev.some((c) => c.data.name === parsed.card.data.name)) {
				setNotice(`${parsed.card.data.name} is already in your library.`);
				return prev;
			}
			const next = [...prev, parsed.card];
			saveCards(next);
			setNotice(`Imported ${parsed.card.data.name}.`);
			return next;
		});
	};

	const handleDelete = (name: string) => {
		setCards((prev) => {
			const next = prev.filter((c) => c.data.name !== name);
			saveCards(next);
			setNotice(`Removed ${name}.`);
			return next;
		});
	};

	const handleSelect = (profile: CompanionProfile) => {
		setNotice(`${profile.name} is ready — open Chat to talk to them.`);
	};

	return (
		<div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
			<header className="mb-6">
				<h1 className="text-2xl font-bold text-white sm:text-3xl">Character Library</h1>
				<p className="mt-1 text-sm text-gray-400">
					Import TavernAI / SillyTavern character cards and manage the companions available
					in Chat.
				</p>
			</header>

			{notice && (
				<div
					role="status"
					className="mb-5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-gray-300"
				>
					{notice}
				</div>
			)}

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
				<section className="lg:col-span-5">
					<h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-500">
						Import
					</h2>
					<CharacterCardUploader onImport={handleImport} />
				</section>

				<section className="lg:col-span-7">
					<div className="mb-3 flex items-baseline justify-between">
						<h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
							Library
						</h2>
						<span className="text-xs text-gray-500">{cards.length} card(s)</span>
					</div>
					<CharacterGallery cards={cards} onSelect={handleSelect} onDelete={handleDelete} />
				</section>
			</div>

			<p className="mt-8 text-xs text-gray-600">
				Cards are stored locally in this browser and shared with Chat.
			</p>
		</div>
	);
}
