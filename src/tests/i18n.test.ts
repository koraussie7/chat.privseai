import { describe, expect, it } from "vitest";
import {
	DEFAULT_LOCALE,
	SUPPORTED_LOCALES,
	lookup,
	interpolate,
	plural,
} from "@/lib/i18n";

const en = {
	common: { hello: "Hello" },
	home: {
		title: "Welcome",
		greeting: "Hi, {name}!",
		cart: { one: "{count} item", other: "{count} items" },
	},
};

describe("i18n helpers", () => {
	it("SUPPORTED_LOCALES includes all six supported languages", () => {
		expect(SUPPORTED_LOCALES).toEqual(["en", "ko", "ja", "zh", "my", "vi"]);
		expect(DEFAULT_LOCALE).toBe("en");
	});

	it("lookup resolves flat dotted keys", () => {
		expect(lookup(en, "common.hello")).toBe("Hello");
		expect(lookup(en, "home.title")).toBe("Welcome");
		expect(lookup(en, "missing.key")).toBeNull();
	});

	it("interpolate substitutes {name} placeholders", () => {
		expect(interpolate(en.home.greeting, { name: "World" })).toBe("Hi, World!");
		expect(interpolate("no placeholders", {})).toBe("no placeholders");
	});

	it("interpolate leaves unknown placeholders untouched", () => {
		expect(interpolate("{a} and {b}", { a: "x" })).toBe("x and {b}");
	});

	it("plural picks 'one' for 1 and 'other' otherwise (raw, no interpolation)", () => {
		// plural() returns the raw template — useI18n's tPlural() is what
		// applies interpolation with {count}.
		expect(plural(en, "home.cart", 1)).toBe("{count} item");
		expect(plural(en, "home.cart", 0)).toBe("{count} items");
		expect(plural(en, "home.cart", 5)).toBe("{count} items");
	});

	it("plural falls back to the bare string when no one/other subtree", () => {
		expect(plural(en, "common.hello", 1)).toBe("Hello");
	});
});


describe("locale dictionaries", () => {
	it("Myanmar and Vietnamese contain core UI translations", async () => {
		const [my, vi] = await Promise.all([
			import("@/lib/locales/my.json"),
			import("@/lib/locales/vi.json"),
		]);
		for (const locale of [my.default, vi.default]) {
			expect(locale.common.signIn).toBeTruthy();
			expect(locale.guest.badge).toBeTruthy();
			expect(locale.loginPage.signinTitle).toBeTruthy();
			expect(locale.pricing.title).toBeTruthy();
		}
	});
});
