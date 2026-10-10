import { useAIHub } from "@/hooks/useAIHub";
import {
	searchAllStock,
	type StockImage,
} from "@/lib/stock-image-client";
import { useEffect, useRef, useState } from "react";

/**
 * Safe stock-image search panel.
 *
 * Fans out queries to Unsplash Source + Wikimedia Commons and lets the
 * user attach results to a companion's AIHub package. Stock images are
 * stored as ImageAsset with `metadata.source` set so the UI can render
 * a "Stock" badge and the P2P share path can strip them before broadcast.
 *
 * No images are proxied or stored on the server — the original CDN URL
 * is kept as `ImageAsset.url` and hotlinked at render time.
 */
export function StockImageSearch() {
	const { aiHub } = useAIHub();
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<StockImage[]>([]);
	const [loading, setLoading] = useState(false);
	const [errors, setErrors] = useState<{ unsplash?: string; wikimedia?: string }>({});
	const [feedback, setFeedback] = useState<string | null>(null);
	const [selectedPkgId, setSelectedPkgId] = useState<string>("");
	const debounceRef = useRef<number | null>(null);

	// Default package: pick the first available one for attach-target.
	const packages = Array.from((aiHub as unknown as { packages?: Map<string, unknown> }).packages?.entries() ?? []);
	useEffect(() => {
		if (!selectedPkgId && packages.length > 0) {
			setSelectedPkgId(packages[0][0]);
		}
	}, [packages, selectedPkgId]);

	const runSearch = async (q: string) => {
		if (!q.trim()) {
			setResults([]);
			return;
		}
		setLoading(true);
		setErrors({});
		try {
			const { results, errors } = await searchAllStock({ query: q, count: 12 });
			setResults(results);
			setErrors(errors);
		} finally {
			setLoading(false);
		}
	};

	const onQueryChange = (v: string) => {
		setQuery(v);
		if (debounceRef.current) window.clearTimeout(debounceRef.current);
		debounceRef.current = window.setTimeout(() => runSearch(v), 500);
	};

	const onAttach = (stock: StockImage) => {
		if (!selectedPkgId) {
			setFeedback("Pick a companion package first.");
			return;
		}
		const asset = aiHub.addStockImage(selectedPkgId, stock);
		if (asset) {
			setFeedback(`✓ Added \"${stock.title}\" to package.`);
			window.setTimeout(() => setFeedback(null), 2500);
		} else {
			setFeedback("Failed to attach (package missing?).");
		}
	};

	return (
		<div className="rounded-3xl border border-white/10 bg-[#0e1017] p-5 mb-8">
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
				<div>
					<h2 className="text-lg font-bold text-white flex items-center gap-2">
						🌍 Stock Image Search
						<span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
							ToS-safe
						</span>
					</h2>
					<p className="text-xs text-gray-400 mt-1">
						Unsplash + Wikimedia Commons — safe-for-work stock images for companions.
					</p>
				</div>
				<select
					value={selectedPkgId}
					onChange={(e) => setSelectedPkgId(e.target.value)}
					className="bg-[#13141f] border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-pink-500/50"
				>
					<option value="">Select companion package…</option>
					{packages.map(([id, p]) => {
						const meta = (p as { metadata?: { name?: string } }).metadata;
						return (
							<option key={id} value={id}>
								{meta?.name ?? id}
							</option>
						);
					})}
				</select>
			</div>

			<input
				type="text"
				value={query}
				onChange={(e) => onQueryChange(e.target.value)}
				placeholder='e.g. "forest sunrise", "tokyo night", "cat portrait"'
				className="w-full bg-[#13141f] border border-white/10 rounded-2xl px-4 py-2.5 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-pink-500/50 mb-4"
			/>

			{feedback && (
				<div className="text-xs text-pink-300 mb-3">{feedback}</div>
			)}

			{loading && (
				<div className="text-xs text-gray-400 mb-3">Searching…</div>
			)}

			{(errors.unsplash || errors.wikimedia) && (
				<div className="text-[10px] text-amber-300/80 mb-3">
					{errors.unsplash && <div>Unsplash: {errors.unsplash}</div>}
					{errors.wikimedia && <div>Wikimedia: {errors.wikimedia}</div>}
				</div>
			)}

			{results.length > 0 && (
				<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
					{results.map((r) => (
						<div
							key={r.id}
							className="group relative rounded-2xl overflow-hidden border border-white/10 bg-[#13141f] hover:border-pink-500/40 transition"
						>
							<img
								src={r.thumbnailUrl}
								alt={r.title}
								loading="lazy"
								referrerPolicy="no-referrer"
								className="w-full h-32 object-cover"
								onLoad={(e) => {
									const el = e.currentTarget;
									if ((!r.width || !r.height) && el.naturalWidth) {
										r.width = el.naturalWidth;
										r.height = el.naturalHeight;
									}
								}}
							/>
							<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
								<div className="flex items-center justify-between gap-1">
									<span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/15 text-white">
										{r.source === "picsum" ? "PICSUM" : r.source.toUpperCase()}
									</span>
									<button
										type="button"
										onClick={() => onAttach(r)}
										className="text-[10px] px-2 py-0.5 rounded bg-pink-500 hover:bg-pink-600 text-white font-semibold"
									>
										+ Attach
									</button>
								</div>
								<div className="text-[10px] text-gray-300 truncate mt-1">{r.title}</div>
							</div>
						</div>
					))}
				</div>
			)}

			{!loading && results.length === 0 && query.trim() && (
				<div className="text-xs text-gray-500">No results.</div>
			)}
		</div>
	);
}
