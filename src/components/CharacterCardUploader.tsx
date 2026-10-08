import { useState, useCallback } from "react";
import { CharacterCardParser } from "@/lib/character-card";
import type { ParsedCharacterCard } from "@/types/character";

interface Props {
	onImport: (card: ParsedCharacterCard) => void;
}

export function CharacterCardUploader({ onImport }: Props) {
	const [isDragging, setIsDragging] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isProcessing, setIsProcessing] = useState(false);

	const handleFile = useCallback(
		async (file: File) => {
			setIsProcessing(true);
			setError(null);
			try {
				const parsed = await CharacterCardParser.parseFile(file);
				onImport(parsed);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to parse character card");
			} finally {
				setIsProcessing(false);
			}
		},
		[onImport],
	);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setIsDragging(false);
			const files = Array.from(e.dataTransfer.files);
			if (files.length > 0) handleFile(files[0]);
		},
		[handleFile],
	);

	const handlePaste = useCallback(
		(e: React.ClipboardEvent) => {
			const items = Array.from(e.clipboardData.files);
			if (items.length > 0) handleFile(items[0]);
		},
		[handleFile],
	);

	return (
		<div className="relative">
			<label
				className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center cursor-pointer transition-all ${
					isDragging
						? "border-cyan-400 bg-cyan-400/[0.06]"
						: "border-white/10 hover:border-white/30 bg-white/[0.02]"
				}`}
			>
				<input
					type="file"
					accept=".json,.png,.jpg,.jpeg,.webp,.character"
					className="hidden"
					onChange={(e) => {
						const file = e.target.files?.[0];
						if (file) handleFile(file);
						e.target.value = "";
					}}
					onPaste={handlePaste}
				/>
				{isProcessing ? (
					<span className="text-xs text-gray-400">Parsing…</span>
				) : (
					<>
						<span className="text-2xl mb-1">📥</span>
						<span className="text-sm font-medium text-gray-200">Import Character Card</span>
						<span className="text-[10px] text-gray-500 mt-1">
							.json / .png / .jpg / .character (SillyTavern v2/v3)
						</span>
					</>
				)}
			</label>
			{error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
			<div
				className="absolute inset-0 rounded-xl"
				onDragOver={(e) => {
					e.preventDefault();
					setIsDragging(true);
				}}
				onDragLeave={() => setIsDragging(false)}
				onDrop={handleDrop}
			/>
		</div>
	);
}
