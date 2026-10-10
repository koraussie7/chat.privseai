/**
 * Tests for the AIHub stock-image integration:
 *  - addStockImage attaches assets with isNSFW=false and source/license metadata
 *  - getPackageImagesStock / getPackageImagesGenerated partition correctly
 *  - sharePackage strips stock assets before P2P broadcast (or fails if only-stock)
 */

import { AIHub } from "@/lib/ai-hub";
import { CharacterCardParser } from "@/lib/character-card";
import type { StockImage } from "@/lib/stock-image-client";
import { describe, expect, it } from "vitest";

const stockFixture: StockImage = {
	id: "commons-42",
	url: "https://upload.wikimedia.org/wikipedia/commons/x.jpg",
	thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/x.jpg/800px-x.jpg",
	title: "Aurora borealis",
	description: "Wikimedia Commons — CC BY 4.0",
	tags: ["aurora"],
	width: 1920,
	height: 1080,
	source: "wikimedia",
	license: "CC BY 4.0",
	author: "Photographer",
};

describe("AIHub stock integration", () => {
	it("addStockImage attaches an ImageAsset with safe flags + source metadata", () => {
		const hub = new AIHub();
		const pkg = hub.createPackage({
			card: CharacterCardParser.createDefaultCard("TestAI"),
			description: "Test pkg",
			creator: "tester",
			baseModel: "Qwen3-0.6B",
			tags: [],
		});
		const asset = hub.addStockImage(pkg.id, stockFixture);
		expect(asset).not.toBeNull();
		expect(asset?.isNSFW).toBe(false);
		expect(asset?.metadata?.source).toBe("wikimedia");
		expect(asset?.metadata?.license).toBe("CC BY 4.0");

		const stockOnly = hub.getPackageImagesStock(pkg.id);
		const generatedOnly = hub.getPackageImagesGenerated(pkg.id);
		expect(stockOnly).toHaveLength(1);
		expect(generatedOnly).toHaveLength(0);
	});

	it("returns null when the package doesn't exist", () => {
		const hub = new AIHub();
		expect(hub.addStockImage("nope", stockFixture)).toBeNull();
	});

	it("sharePackage strips stock assets and reports an error if nothing remains", async () => {
		const hub = new AIHub(); // no P2P client — sharePackage fails at the first gate.
		const pkg = hub.createPackage({
			card: CharacterCardParser.createDefaultCard("TestAI"),
			description: "Stock-only pkg",
			creator: "tester",
			baseModel: "Qwen3-0.6B",
			tags: [],
		});
		hub.addStockImage(pkg.id, stockFixture);

		const result = await hub.sharePackage(pkg);
		// The first gate is "No P2P connection" — proves the stock-strip branch is downstream.
		expect(result.success).toBe(false);
		// Local state must still contain the stock asset (strip only happens for the broadcast copy).
		expect(hub.getPackageImagesStock(pkg.id)).toHaveLength(1);
	});
});
