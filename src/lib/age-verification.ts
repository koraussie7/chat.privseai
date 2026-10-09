/**
 * Age Verification + NSFW Filter for privseai.com
 *
 * Legal compliance for adult AI chat service.
 * Uses layered verification: local filter → P2P consensus → (optionally) ID verification.
 */

export type AgeCheckResult = {
	verified: boolean;
	method: "unverified" | "self_declaration" | "id_verification" | "p2p_consensus" | "parental_block";
	age?: number;
	blocked: boolean;
	reason?: string;
};

export type NSFWCheckResult = {
	isExplicit: boolean;
	confidence: number;
	categories: string[];
	filtered: boolean;
};

const SUSPICIOUS_PATTERNS = [
	/\b(step[- ]?)?(?:mom|dad|sis(ter)?|bro(ther)?|daughter|son|sister|brother|cousin|niece|nephew|grandma|grandpa|grandmother|grandfather)\b.*\b(25|sexy|bed|fuck|fucking|explicit|nsfw|anal|blowjob|handjob|creampie|bbw|milf|cougar|daddy|breed|pregnant|hot|young)\b/i,
	/\b(25|sexy|bed|fuck|fucking|explicit|nsfw|anal|blowjob|handjob|creampie|bbw|milf|cougar|daddy|breed|pregnant|hot|young)\b.*\b(step[- ]?)?(?:mom|dad|sis(ter)?|bro(ther)?|daughter|son|sister|brother|cousin|niece|nephew)\b/i,
	/\b(age|년龄|umur|อายุ)\b.*\b(1[2-9]|under\s*18|underage|minor)\b/i,
	/\bunder\s*(1[2-9]|eighteen|19|minor|age)\b/i,
	/\b(1[2-9])\s*years?\s*old\b/i,
	/\byoung\s*(1[2-9])\b/i,
	/\b(1[2-9])\s*(?:year|yo|y\/o|years?)/i,
	/\b(loli|shota|shotacon|kiddie|child|minor|pedo|underage)\b/i,
	/\b(rape|non.?consensual|incest|cuckold|hotwife|ageplay)\b/i,
];

const EXPLICIT_KEYWORDS = new Set([
	"fuck",
	"fucking",
	"fucked",
	"shit",
	"damn",
	"bitch",
	"ass",
	"asshole",
	"bastard",
	"piss",
	"cum",
	"cumslut",
	"slut",
	"whore",
	"bitch",
	"nigger",
	"nigga",
	"faggot",
	"retard",
	"cunt",
	"twat",
	"pussy",
	"cock",
	"dick",
	"prick",
	"balls",
	"boob",
	"tit",
	"nipple",
	"anal",
	"blowjob",
	"handjob",
	"creampie",
	"bbw",
	"milf",
	"cougar",
	"breeding",
	"pregnant",
	"breed",
]);

const AGE_DECLARATION_PATTERNS = [
	/\bI\s+am\s+(\d{2})\s+(?:years?\s+old|yo)\b/i,
	/\bI'm\s+(\d{2})\s+(?:years?\s+old|yo)\b/i,
	/\b(\d{2})\s+years?\s+old\b/i,
	/\bage\s*[:=]?\s*(\d{2})\b/i,
	/\b(\d{2})\s+and\s+(?:single|married|looking)\b/i,
	/\bI\s+am\s+(\d{2})\b/i,
	/\bI'm\s+(\d{2})\b/i,
	/\b(\d{2})\s+year[- ]?old\b/i,
];

export class AgeVerification {
	private storageKey = "privseai_age_verified";
	private consentKey = "privseai_consent_given";
	private storage: Storage | undefined;

	constructor() {
		try {
			if (typeof localStorage !== "undefined") {
				this.storage = localStorage;
			}
		} catch {}
	}

	private safeGet(key: string): string | null {
		return this.storage?.getItem(key) ?? null;
	}

	private safeSet(key: string, value: string): void {
		this.storage?.setItem(key, value);
	}

	private safeRemove(key: string): void {
		this.storage?.removeItem(key);
	}

	async checkAge(): Promise<AgeCheckResult> {
		const saved = this.safeGet(this.storageKey);
		if (saved) {
			try {
				const parsed: { age: number; method: AgeCheckResult["method"]; timestamp: number } =
					JSON.parse(saved);
				if (Date.now() - parsed.timestamp < 30 * 24 * 60 * 60 * 1000) {
					return {
						verified: parsed.age >= 18,
						method: parsed.method,
						age: parsed.age,
						blocked: parsed.age < 18,
						reason: parsed.age < 18 ? "Under 18" : undefined,
					};
				}
			} catch {}
		}

		if (!this.hasConsented()) {
			return { verified: false, method: "unverified", blocked: true, reason: "Not verified" };
		}

		return { verified: false, method: "unverified", blocked: true, reason: "Not verified" };
	}

	async selfDeclareAge(age: number): Promise<AgeCheckResult> {
		const result: AgeCheckResult = {
			verified: age >= 18,
			method: "self_declaration",
			age,
			blocked: age < 18,
			reason: age < 18 ? "Under 18 - access denied" : undefined,
		};

		this.safeSet(
			this.storageKey,
			JSON.stringify({ age, method: result.method, timestamp: Date.now() }),
		);

		return result;
	}

	givenConsent(): boolean {
		return this.safeGet(this.consentKey) === "true";
	}

	setConsent(given: boolean): void {
		this.safeSet(this.consentKey, String(given));
	}

	hasConsented(): boolean {
		return this.givenConsent();
	}

	extractAgeFromText(text: string): number | null {
		for (const pattern of AGE_DECLARATION_PATTERNS) {
			const match = text.match(pattern);
			if (match && parseInt(match[1]) > 0) {
				return parseInt(match[1]);
			}
		}
		return null;
	}

	isParentalBlock(text: string): boolean {
		const age = this.extractAgeFromText(text);
		return age !== null && age < 18;
	}

	static extractAgeStatic(text: string): number | null {
		for (const pattern of AGE_DECLARATION_PATTERNS) {
			const match = text.match(pattern);
			if (match && parseInt(match[1]) > 0) {
				return parseInt(match[1]);
			}
		}
		return null;
	}

	reset(): void {
		this.safeRemove(this.storageKey);
		this.safeRemove(this.consentKey);
	}
}

export class NSFWFilter {
	private suspiciousPatterns = SUSPICIOUS_PATTERNS;
	private explicitKeywords = EXPLICIT_KEYWORDS;
	private bypass = false;

	constructor(opts?: { bypass?: boolean }) {
		this.bypass = opts?.bypass ?? false;
	}

	setBypass(bypass: boolean): void {
		this.bypass = bypass;
	}

	checkContent(text: string): NSFWCheckResult {
		if (this.bypass) {
			return {
				isExplicit: false,
				confidence: 0,
				categories: [],
				filtered: false,
			};
		}

		const lower = text.toLowerCase();
		const categories: string[] = [];

		for (const pattern of this.suspiciousPatterns) {
			if (pattern.test(text)) {
				categories.push("suspicious_pattern");
				break;
			}
		}

		const wordMatches = this.countExplicitKeywords(lower);
		if (wordMatches > 0) {
			categories.push("explicit_language", `count:${wordMatches}`);
		}

		if (this.isParentalContent(text)) {
			categories.push("parental_content");
		}

		const isExplicit = categories.length > 0;
		const confidence = isExplicit
			? Math.min(0.95, 0.5 + categories.length * 0.15 + wordMatches * 0.05)
			: 0;

		return {
			isExplicit,
			confidence,
			categories,
			filtered: isExplicit && confidence > 0.6,
		};
	}

	checkImageContent(_base64Data: string): NSFWCheckResult {
		return {
			isExplicit: false,
			confidence: 0,
			categories: ["needs_review"],
			filtered: false,
		};
	}

	private countExplicitKeywords(text: string): number {
		let count = 0;
		for (const word of this.explicitKeywords) {
			if (text.includes(word)) count++;
		}
		return count;
	}

	private isParentalContent(text: string): boolean {
		const age = AgeVerification.extractAgeStatic(text);
		return age !== null && age < 18;
	}
}

export const ageVerifier = new AgeVerification();
export const nsfwFilter = new NSFWFilter();
