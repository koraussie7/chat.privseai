import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AgeVerification, NSFWFilter } from "@/lib/age-verification";

const storageMap = new Map<string, string>();

vi.stubGlobal("localStorage", {
	getItem: (key: string) => storageMap.get(key) ?? null,
	setItem: (key: string, value: string) => {
		storageMap.set(key, value);
	},
	removeItem: (key: string) => {
		storageMap.delete(key);
	},
	clear: () => {
		storageMap.clear();
	},
});

describe("AgeVerification", () => {
	let verifier: AgeVerification;

	beforeEach(() => {
		storageMap.clear();
		verifier = new AgeVerification();
		verifier.reset();
	});

	afterEach(() => {
		verifier.reset();
	});

	it("blocks unverified users", async () => {
		const result = await verifier.checkAge();
		expect(result.verified).toBe(false);
		expect(result.blocked).toBe(true);
		expect(result.method).toBe("unverified");
	});

	it("allows age 18+ self-declaration", async () => {
		const result = await verifier.selfDeclareAge(18);
		expect(result.verified).toBe(true);
		expect(result.blocked).toBe(false);
		expect(result.age).toBe(18);
		expect(result.method).toBe("self_declaration");
	});

	it("blocks age under 18", async () => {
		const result = await verifier.selfDeclareAge(17);
		expect(result.verified).toBe(false);
		expect(result.blocked).toBe(true);
		expect(result.age).toBe(17);
		expect(result.reason).toBe("Under 18 - access denied");
	});

	it("persists age declaration in localStorage", async () => {
		await verifier.selfDeclareAge(25);
		const result = await verifier.checkAge();
		expect(result.verified).toBe(true);
		expect(result.age).toBe(25);
	});

	it("extracts age from text", () => {
		expect(verifier.extractAgeFromText("I am 18 years old")).toBe(18);
		expect(verifier.extractAgeFromText("I'm 25 yo")).toBe(25);
		expect(verifier.extractAgeFromText("성인입니다 30세")).toBeNull();
		expect(verifier.extractAgeFromText("I am 15 and single")).toBe(15);
	});

	it("detects parental content", () => {
		expect(verifier.isParentalBlock("I am 15 years old")).toBe(true);
		expect(verifier.isParentalBlock("I am 25, single")).toBe(false);
	});

	it("manages consent state", () => {
		expect(verifier.hasConsented()).toBe(false);
		verifier.setConsent(true);
		expect(verifier.hasConsented()).toBe(true);
		verifier.setConsent(false);
		expect(verifier.hasConsented()).toBe(false);
	});

	it("resets verification state", async () => {
		await verifier.selfDeclareAge(30);
		verifier.reset();
		const result = await verifier.checkAge();
		expect(result.verified).toBe(false);
	});
});

describe("NSFWFilter", () => {
	let filter: NSFWFilter;

	beforeEach(() => {
		filter = new NSFWFilter();
	});

	it("passes clean content", () => {
		const result = filter.checkContent("Hello, how are you today?");
		expect(result.isExplicit).toBe(false);
		expect(result.filtered).toBe(false);
		expect(result.confidence).toBe(0);
	});

	it("detects explicit language", () => {
		const result = filter.checkContent("I want to fuck you hard");
		expect(result.isExplicit).toBe(true);
		expect(result.filtered).toBe(true);
		expect(result.categories).toContain("explicit_language");
		expect(result.confidence).toBeGreaterThan(0.6);
	});

	it("detects suspicious relationship patterns", () => {
		const result = filter.checkContent("My 25 year old stepmom is so hot");
		expect(result.isExplicit).toBe(true);
		expect(result.categories).toContain("suspicious_pattern");
	});

	it("detects parental content", () => {
		const result = filter.checkContent("I am 15 and want to chat");
		expect(result.isExplicit).toBe(true);
		expect(result.categories).toContain("parental_content");
	});

	it("calculates confidence correctly", () => {
		const result = filter.checkContent("fuck shit damn bitch");
		expect(result.confidence).toBeGreaterThan(0.8);
	});

	it("handles image content check (placeholder)", () => {
		const result = filter.checkImageContent("base64data");
		expect(result.categories).toContain("needs_review");
		expect(result.isExplicit).toBe(false);
	});

	it("filters multiple keywords", () => {
		const result = filter.checkContent("You're such a slut, I want your pussy and cock");
		expect(result.isExplicit).toBe(true);
		expect(result.categories).toContain("explicit_language");
	});

	it("does not false-positive on clean text", () => {
		const result = filter.checkContent("Can you help me with my homework?");
		expect(result.isExplicit).toBe(false);
	});
});
