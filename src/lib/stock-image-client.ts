/**
 * Stock image client — safe image sources for CandyDiscover / CandyCollection.
 *
 * Sources (ToS-friendly, no auth required):
 *  - Picsum (https://picsum.photos) — curated photos sourced from Unsplash
 *    photographers, served under the Unsplash License. No keyword search; we
 *    treat each call as "random photos tagged with this query label".
 *  - Wikimedia Commons API (https://commons.wikimedia.org/w/api.php) — CC /
 *    public-domain images, full metadata, proper CORS support, real search.
 *
 * Design goals:
 *  - Zero server cost: original CDN URLs only, no proxy, no disk caching.
 *  - Zero NSFW risk: both sources are curated safe; we mark isNSFW=false explicitly.
 *  - Composable: each source implements the same shape so the UI can fan out.
 */

export type StockSource = "picsum" | "wikimedia";

export interface StockImage {
	id: string;
	url: string;
	thumbnailUrl: string;
	title: string;
	description: string;
	tags: string[];
	width: number;
	height: number;
	source: StockSource;
	license: string;
	author?: string;
	authorUrl?: string;
}

export interface StockSearchOptions {
	query: string;
	count?: number;
	signal?: AbortSignal;
}

const UA = "privseai-trystero/1.0 (CandyDiscover; stock image client)";

/* ------------------------------------------------------------------ */
/* Picsum                                                              */
/* ------------------------------------------------------------------ */
/**
 * Picsum serves a curated catalog of Unsplash-hosted photos
 * (https://picsum.photos/about). It does NOT support keyword search, so we
 * use it as a *random* source: each call returns a random subset of the
 * catalog with the user query attached as a hint label.
 *
 * License: Picsum's photos are sourced from Unsplash and inherit the
 * Unsplash License (free for commercial and non-commercial use; no attribution
 * required but we surface `author` anyway).
 */
interface PicsumEntry {
	id: string;
	author: string;
	width: number;
	height: number;
	url: string;
	download_url: string;
}

export async function searchPicsum(
	opts: StockSearchOptions,
): Promise<StockImage[]> {
	const count = Math.min(opts.count ?? 10, 30);
	try {
		const page = Math.floor(Math.random() * 20) + 1;
		const res = await fetch(
			`https://picsum.photos/v2/list?page=${page}&limit=${Math.min(count * 2, 100)}`,
			{
				signal: opts.signal,
				headers: { "User-Agent": UA, Accept: "application/json" },
			},
		);
		if (!res.ok) return [];
		const list = (await res.json()) as PicsumEntry[];
		const shuffled = list.sort(() => Math.random() - 0.5);
		return shuffled.slice(0, count).map((p, idx) => ({
			id: `picsum-${p.id}`,
			url: `https://picsum.photos/id/${p.id}/800/1000`,
			thumbnailUrl: `https://picsum.photos/id/${p.id}/400/500`,
			title: `${opts.query || "photo"} #${idx + 1}`,
			description: `Picsum / Unsplash — photo by ${p.author}`,
			tags: opts.query.split(/\s+/).filter(Boolean),
			width: p.width,
			height: p.height,
			source: "picsum",
			license: "Unsplash License (via Picsum; free commercial and non-commercial)",
			author: p.author,
		}));
	} catch {
		return [];
	}
}

/* ------------------------------------------------------------------ */
/* Wikimedia Commons                                                   */
/* ------------------------------------------------------------------ */
/**
 * Wikimedia Commons search returns file metadata including the
 * thumbnail URL. License is parsed from `extmetadata`; only permissive
 * licenses are accepted (CC-BY, CC-BY-SA, CC0, Public Domain).
 */
interface CommonsSearchResponse {
	query?: {
		pages?: Record<
			string,
			{
				pageid: number;
				title: string;
				imageinfo?: Array<{
					url: string;
					thumburl?: string;
					width: number;
					height: number;
					mime: string;
					extmetadata?: Record<string, { value: string } | undefined>;
				}>;
			}
		>;
	};
}

const ALLOWED_WIKIMEDIA_LICENSES = [
	"CC BY",
	"CC-BY",
	"CC BY-SA",
	"CC-BY-SA",
	"CC0",
	"Public Domain",
	"Public domain",
];

function isAllowedLicense(licenseRaw: string): boolean {
	return ALLOWED_WIKIMEDIA_LICENSES.some((needle) =>
		licenseRaw.toLowerCase().includes(needle.toLowerCase()),
	);
}

export async function searchWikimedia(
	opts: StockSearchOptions,
): Promise<StockImage[]> {
	const count = Math.min(opts.count ?? 12, 30);
	// NOTE: Wikimedia API expects `iiprop` as `url|size|mime|extmetadata`.
	// Requesting `thumburl` directly triggers a warning that strips the field.
	const params = new URLSearchParams({
		action: "query",
		format: "json",
		generator: "search",
		gsrsearch: opts.query,
		gsrnamespace: "6",
		gsrlimit: String(count * 2),
		prop: "imageinfo",
		iiprop: "url|size|mime|extmetadata",
		iiurlwidth: "800",
		crossorigin: "anonymous",
		origin: "*",
	});
	const url = `https://commons.wikimedia.org/w/api.php?${params.toString()}`;
	try {
		const res = await fetch(url, {
			signal: opts.signal,
			headers: { "User-Agent": UA, Accept: "application/json" },
		});
		if (!res.ok) return [];
		const json = (await res.json()) as CommonsSearchResponse;
		const pages = json.query?.pages ?? {};
		const out: StockImage[] = [];
		for (const page of Object.values(pages)) {
			const info = page.imageinfo?.[0];
			if (!info || !info.thumburl) continue;
			if (!info.mime.startsWith("image/")) continue;
			const licenseRaw = info.extmetadata?.["LicenseShortName"]?.value ?? "";
			if (!isAllowedLicense(licenseRaw)) continue;
			const author =
				info.extmetadata?.["Artist"]?.value?.replace(/<[^>]+>/g, "").trim() ?? "";
			out.push({
				id: `commons-${page.pageid}`,
				url: info.url,
				thumbnailUrl: info.thumburl,
				title: page.title.replace(/^File:/, "").replace(/\.\w+$/, ""),
				description: `Wikimedia Commons — ${licenseRaw}`,
				tags: opts.query.split(/\s+/).filter(Boolean),
				width: info.width,
				height: info.height,
				source: "wikimedia",
				license: licenseRaw,
				author: author || undefined,
			});
			if (out.length >= count) break;
		}
		return out;
	} catch {
		return [];
	}
}

/* ------------------------------------------------------------------ */
/* Unified facade                                                      */
/* ------------------------------------------------------------------ */
export interface StockSearchResult {
	results: StockImage[];
	errors: Partial<Record<StockSource, string>>;
}

export async function searchAllStock(
	opts: StockSearchOptions,
): Promise<StockSearchResult> {
	const [picsum, wikimedia] = await Promise.allSettled([
		searchPicsum(opts),
		searchWikimedia(opts),
	]);
	const errors: Partial<Record<StockSource, string>> = {};
	const results: StockImage[] = [];
	if (picsum.status === "fulfilled") {
		results.push(...picsum.value);
	} else {
		errors.picsum = String(picsum.reason);
	}
	if (wikimedia.status === "fulfilled") {
		results.push(...wikimedia.value);
	} else {
		errors.wikimedia = String(wikimedia.reason);
	}
	return { results, errors };
}

export function stockImageToImageAsset(stock: StockImage): import("@/types/ai-package").ImageAsset {
	return {
		id: stock.id,
		url: stock.thumbnailUrl || stock.url,
		thumbnailUrl: stock.thumbnailUrl || stock.url,
		title: stock.title,
		description: stock.description,
		prompt: stock.tags.join(", "),
		model: `${stock.source}-stock`,
		width: stock.width || undefined,
		height: stock.height || undefined,
		generatedAt: Date.now(),
		tags: [...stock.tags, `source:${stock.source}`, `license:${stock.license}`],
		isFavorite: false,
		isNSFW: false,
		metadata: {
			source: stock.source,
			license: stock.license,
			author: stock.author,
			originalUrl: stock.url,
		},
	};
}

export const STOCK_SOURCES: StockSource[] = ["picsum", "wikimedia"];
