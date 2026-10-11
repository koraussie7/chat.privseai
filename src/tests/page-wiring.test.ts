import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards against the exact failure that shipped twice: a page (or a whole
 * component) that is fully written but never mounted, so it is unreachable in
 * the running app. Type-checking cannot catch this — an unused import is valid
 * TypeScript — and neither can a render test, since nothing renders it.
 *
 * The check is static on purpose: it compares the page modules on disk against
 * the modules App.tsx actually routes.
 */
const SRC = path.resolve(import.meta.dirname, "..");
const PAGES_DIR = path.join(SRC, "pages");
const APP = path.join(SRC, "App.tsx");
const SIDEBAR = path.join(SRC, "components/CandySidebar.tsx");

const app = fs.readFileSync(APP, "utf8");
const sidebar = fs.readFileSync(SIDEBAR, "utf8");

/** Every `export function XPage` in a page module. */
function pageModules(): string[] {
	return fs
		.readdirSync(PAGES_DIR)
		.filter((f) => f.endsWith(".tsx"))
		.map((f) => f.replace(/\.tsx$/, ""));
}

/** Route paths declared in App.tsx, from `path="/x"` or `index`. */
function routedPaths(): string[] {
	return [...app.matchAll(/path="([^"]+)"/g)].map((m) => m[1]);
}

/** True when App.tsx declares an `index` route (i.e. the parent's `/`). */
function hasIndexRoute(): boolean {
	return /\bindex\s+(?:element|\/>)/.test(app);
}

/** `to="/x"` targets in the sidebar. */
function sidebarPaths(): string[] {
	return [...sidebar.matchAll(/to="([^"]+)"/g)].map((m) => m[1]);
}

/**
 * Pages that are legitimately not routed. Add an entry only with a reason:
 * anything listed here is unreachable in the running app.
 */
const INTENTIONALLY_UNROUTED: Record<string, string> = {
	// Superseded by CandyChatPage at /chat; kept only as reference for the
	// PersonalityEngine + CompanionChat pairing. Delete once CandyChatPage
	// covers the emotion/personality surface.
	ChatPage: "duplicate of /chat, which CandyChatPage owns",
};

/**
 * Routed paths that are intentionally absent from the sidebar, with a reason.
 */
const INTENTIONALLY_UNLINKED: Record<string, string> = {
	// Reachable through the Studio tab bar instead of the sidebar.
	"/events": "surfaced via Studio tabs",
	"/evidence": "surfaced via Studio tabs",
	"/forecasts": "surfaced via Studio tabs",
	"/impact": "surfaced via Studio tabs",
	// Reached from the API Keys button in Settings, not the nav.
	"/settings/api-keys": "reached from Settings",
};

describe("page wiring", () => {
	const pages = pageModules().filter((p) => !(p in INTENTIONALLY_UNROUTED));

	it.each(pages)("%s is imported by App.tsx", (page) => {
		expect(app).toContain(`pages/${page}`);
	});

	it.each(pages)("%s is rendered as a route element", (page) => {
		// Pages may take props (`<PricingPage onBack={goHome} />`), so match the
		// opening tag rather than a self-closing one.
		expect(app).toMatch(new RegExp(`<${page}[\\s/>]`));
	});

	it("lists a reason for every unrouted page module", () => {
		const unlisted = pageModules().filter(
			(p) => !INTENTIONALLY_UNROUTED[p] && !app.includes(`pages/${p}`),
		);
		expect(unlisted).toEqual([]);
	});
});

describe("navigation wiring", () => {
	const routed = routedPaths();
	const linked = sidebarPaths();

	it("declares routes", () => {
		expect(routed.length).toBeGreaterThan(0);
	});

	it("has no dead sidebar links pointing at unrouted paths", () => {
		// `/` is served by the `index` route, which has no `path=` attribute.
		const known = hasIndexRoute() ? [...routed, "/"] : routed;
		const unrouted = linked.filter((p) => !known.includes(p));
		expect(unrouted).toEqual([]);
	});

	it("links every routable path, or records why not", () => {
		const candidates = routed.filter(
			(p) => p.startsWith("/") && !p.includes(":") && p !== "*",
		);
		// `/` resolves to the index route; treat it as linked when present.
		if (hasIndexRoute()) candidates.push("/");
		const missing = candidates.filter(
			(p) => !linked.includes(p) && !INTENTIONALLY_UNLINKED[p],
		);
		expect(missing).toEqual([]);
	});
});
