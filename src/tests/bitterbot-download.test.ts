/**
 * Tests for the BYOK onboarding helpers (bitterbot-download.ts).
 * Focus: no-key-leave-the-browser guarantee + generated script correctness.
 */
import { describe, expect, it } from "vitest";
import {
	buildProvisionScript,
	kiloKeyExpiryHint,
	looksLikeKiloKey,
} from "@/lib/bitterbot-download";

// Valid-shape test key (NOT a real credential — base64url JWT-like).
const FAKE_KEY = [
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
	"eyJzdWIiOiJ0ZXN0IiwiZXhwIjo0MDcwOTA4ODAwfQ",
	"s1gn4tur3-signature-signature-signature-sig",
].join(".");

describe("looksLikeKiloKey", () => {
	it("accepts a JWT-shaped key", () => {
		expect(looksLikeKiloKey(FAKE_KEY)).toBe(true);
	});
	it("rejects non-JWT strings", () => {
		expect(looksLikeKiloKey("sk-ant-abc123")).toBe(false);
		expect(looksLikeKiloKey("")).toBe(false);
	});
});

describe("kiloKeyExpiryHint", () => {
	it("reports a future expiry", () => {
		const hint = kiloKeyExpiryHint(FAKE_KEY);
		expect(hint).toMatch(/년 후 만료/);
	});
	it("returns null for payloads without exp", () => {
		const key = ["eyJhbGciOiJIUzI1NiJ9", "eyJzdWIiOiJ0ZXN0In0", "sig-sig-sig-sig"].join(".");
		expect(kiloKeyExpiryHint(key)).toBeNull();
	});
});

describe("buildProvisionScript", () => {
	const script = buildProvisionScript({ kiloKey: FAKE_KEY });

	it("writes the key only to the user's own machine (no upload)", () => {
		expect(script).toMatch(/KILOCODE_API_KEY/);
		expect(script).toMatch(/LaunchAgents\/ai\.bitterbot\.gateway\.plist/);
		expect(script).not.toMatch(/curl|fetch|upload|privseai\.com\/api/);
	});

	it("sets kilo-auto/free as primary with free fallbacks", () => {
		expect(script).toMatch(/kilo-auto\/free/);
		expect(script).toMatch(/ovh-ai\/Mistral-Small-3\.2-24B-Instruct-2506/);
		expect(script).toMatch(/pollinations\/openai-fast/);
	});

	it("imports the companion seed with path-traversal guard", () => {
		expect(script).toMatch(/privseai-bitterbot-seed/);
		expect(script).toMatch(/"\.\." not in rel/);
	});

	it("optionally embeds the Groq key when provided", () => {
		const withGroq = buildProvisionScript({ kiloKey: FAKE_KEY, groqKey: "gsk_test" });
		expect(withGroq).toMatch(/GROQ_API_KEY/);
	});
});
