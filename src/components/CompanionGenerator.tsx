import { useState } from "react";
import { useAIHub } from "@/hooks/useAIHub";
import { generateCharacterCard, CharacterGenError } from "@/lib/character-generator";

/**
 * One-click companion creation (OpenPerso Phase 2).
 * Name + description -> server-generated chara_card_v2 -> AIHub package.
 */
export function CompanionGenerator({ onCreated }: { onCreated?: (packageId: string) => void }) {
	const { aiHub } = useAIHub();
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [controller, setController] = useState<AbortController | null>(null);

	const generate = async () => {
		setError("");
		setNotice("");
		setBusy(true);
		const abort = new AbortController();
		setController(abort);
		try {
			const { card } = await generateCharacterCard({
				name,
				description,
				signal: abort.signal,
			});
			const pkg = aiHub.createPackage({
				card,
				description: card.data.description,
				creator: card.data.creator,
				baseModel: "gemini-2.5-flash-generated",
				tags: card.data.tags,
			});
			setNotice(`Companion "${card.data.name}" created. Open Discover or Collection to start chatting.`);
			setName("");
			setDescription("");
			onCreated?.(pkg.id);
		} catch (e) {
			if (!abort.signal.aborted) {
				setError(e instanceof CharacterGenError ? e.message : "Character generation failed.");
			}
		} finally {
			setBusy(false);
			setController(null);
		}
	};

	return (
		<section className="rounded-3xl border border-white/10 bg-[#0e1017] p-5 mb-6" aria-labelledby="companion-gen-title">
			<div className="mb-4">
				<h2 id="companion-gen-title" className="text-lg font-bold text-white">✨ One-Click Companion</h2>
				<p className="mt-1 text-xs text-gray-400">
					Describe a character in one sentence — a full roleplay card is generated for you.
				</p>
			</div>

			<label className="block text-xs text-gray-300 mb-1" htmlFor="comp-gen-name">
				Character name
			</label>
			<input
				id="comp-gen-name"
				type="text"
				value={name}
				onChange={(e) => setName(e.target.value)}
				maxLength={40}
				placeholder="e.g. Luna"
				className="w-full rounded-xl bg-[#13141f] border border-white/10 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-pink-500/50 mb-3"
			/>

			<label className="block text-xs text-gray-300 mb-1" htmlFor="comp-gen-desc">
				Describe the character
			</label>
			<textarea
				id="comp-gen-desc"
				value={description}
				onChange={(e) => setDescription(e.target.value)}
				maxLength={2000}
				rows={3}
				placeholder="e.g. a witty astronomer who names every star she discovers after desserts"
				className="w-full rounded-xl bg-[#13141f] border border-white/10 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-pink-500/50 mb-3"
			/>

			<div className="flex items-center gap-3">
				<button
					type="button"
					onClick={generate}
					disabled={busy || !name.trim() || description.trim().length < 10}
					className="rounded-xl bg-pink-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
				>
					{busy ? "Generating…" : "Create companion"}
				</button>
				{busy && (
					<button
						type="button"
						onClick={() => controller?.abort()}
						className="rounded-xl bg-white/10 px-4 py-2 text-sm text-white"
					>
						Cancel
					</button>
				)}
			</div>

			{error && (
				<p role="alert" className="mt-3 text-sm text-red-300">
					{error}
				</p>
			)}
			{notice && (
				<p role="status" className="mt-3 text-sm text-emerald-300">
					{notice}
				</p>
			)}
			<p className="mt-3 text-[10px] text-amber-200/80">
				Generation runs on the PrivseAI server (no API key needed). Content is model-generated — review before sharing.
			</p>
		</section>
	);
}
