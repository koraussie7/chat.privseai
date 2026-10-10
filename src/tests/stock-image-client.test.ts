/**
 * Tests for the safe stock-image client (Unsplash + Wikimedia).
 *
 * Covers:
 *  - shape / type-safety of StockImage and the converter
 *  - Wikimedia license filtering (only CC / public domain accepted)
 *  - the searchAllStock fan-out resilience (one source failing ≠ total failure)
 *
 * Network calls are mocked — we do NOT hit the real APIs in CI.
 */

import {
	searchAllStock,
	searchWikimedia,
	stockImageToImageAsset,
	type StockImage,
} from "@/lib/stock-image-client";
import type { ImageAsset } from "@/types/ai-package";
import { afterEach, describe, expect, it, vi } from "vitest";

const FIXTURE: StockImage = {
	id: "unsplash-abc",
	url: "https://images.unsplash.com/photo-1",
	thumbnailUrl: "https://images.unsplash.com/photo-1?w=800",
	title: "forest sunrise",
	description: "Unsplash image matching \"forest sunrise\"",
	tags: ["forest", "sunrise"],
	width: 0,
	height: 0,
	source: "picsum",
	license: "Unsplash License (free for commercial and non-commercial use)",
};

describe("stockImageToImageAsset", () => {
	it("converts a stock image into an ImageAsset with isNSFW forced to false", () => {
		const asset: ImageAsset = stockImageToImageAsset(FIXTURE);
		expect(asset.id).toBe(FIXTURE.id);
		expect(asset.url).toBe(FIXTURE.thumbnailUrl);
		expect(asset.isNSFW).toBe(false);
		expect(asset.metadata?.source).toBe("picsum");
		expect(asset.metadata?.license).toContain("Unsplash");
		expect(asset.tags?.some((t: string) => t.startsWith("source:"))).toBe(true);
		expect(asset.tags?.some((t: string) => t.startsWith("license:"))).toBe(true);
	});

	it("never inherits NSFW even if input metadata is malicious", () => {
		const malicious: StockImage = {
			...FIXTURE,
			id: "x",
			source: "wikimedia",
			license: "CC-BY",
		};
		const a = stockImageToImageAsset(malicious);
		expect(a.isNSFW).toBe(false);
	});
});

describe("searchWikimedia license filter", () => {
	const originalFetch = global.fetch;

	afterEach(() => {
		global.fetch = originalFetch;
	});

	it("accepts CC-BY and rejects 'fair use' claims", async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				query: {
					pages: {
						"1": {
							pageid: 1,
							title: "File:Forest.jpg",
							imageinfo: [
								{
									url: "https://upload.wikimedia.org/forest.jpg",
									thumburl: "https://upload.wikimedia.org/thumb/forest.jpg",
									width: 1920,
									height: 1080,
									mime: "image/jpeg",
									extmetadata: {
										LicenseShortName: { value: "CC BY 4.0" },
										Artist: { value: "<a>Photographer</a>" },
									},
								},
							],
						},
						"2": {
							pageid: 2,
							title: "File:Bad.jpg",
							imageinfo: [
								{
									url: "https://upload.wikimedia.org/bad.jpg",
									thumburl: "https://upload.wikimedia.org/thumb/bad.jpg",
									width: 800,
									height: 600,
									mime: "image/jpeg",
									extmetadata: {
										LicenseShortName: { value: "Fair use" },
									},
								},
							],
						},
					},
				},
			}),
		} as unknown as Response);

		const out = await searchWikimedia({ query: "forest", count: 5 });
		expect(out).toHaveLength(1);
		expect(out[0].license).toContain("CC BY");
		expect(out[0].author).toBe("Photographer");
	});

	it("returns [] on non-2xx response", async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
		} as unknown as Response);
		const out = await searchWikimedia({ query: "x", count: 5 });
		expect(out).toEqual([]);
	});
});

describe("searchAllStock fan-out", () => {
	const originalFetch = global.fetch;

	afterEach(() => {
		global.fetch = originalFetch;
	});

	it("does not reject when both sources fail", async () => {
		// Both sources swallow network errors internally, so searchAllStock should
		// always resolve (never reject) and return an empty result set.
		global.fetch = vi.fn().mockRejectedValue(new Error("network down"));

		const { results } = await searchAllStock({ query: "tree", count: 2 });
		expect(results).toEqual([]);
	});
});
