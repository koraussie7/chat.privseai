import { describe, expect, it } from "vitest";
import { isGuestModeAllowed } from "@/lib/guest-policy";

describe("guest mode policy", () => {
	it("allows browsing without auth on public routes", () => {
		expect(isGuestModeAllowed("/collection")).toBe(true);
		expect(isGuestModeAllowed("/chat")).toBe(true);
		expect(isGuestModeAllowed("/hub")).toBe(true);
		expect(isGuestModeAllowed("/")).toBe(true);
	});

	it("blocks truly private routes from guests", () => {
		expect(isGuestModeAllowed("/settings")).toBe(false);
		expect(isGuestModeAllowed("/settings/api-keys")).toBe(false);
		expect(isGuestModeAllowed("/account")).toBe(false);
		expect(isGuestModeAllowed("/billing")).toBe(false);
	});

	it("redirects the catch-all to /collection (was /login)", () => {
		expect(isGuestModeAllowed("/some-random-thing")).toBe(true);
	});
});
