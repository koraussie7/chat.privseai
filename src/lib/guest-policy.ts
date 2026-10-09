/**
 * guest-policy — single source of truth for which routes are browseable
 * by a guest (unauthenticated) visitor.
 *
 * Public routes: anyone can visit. The AuthGate wrapper is a pass-through
 * for these so the React tree never needs to know whether the visitor is
 * signed in.
 *
 * Private routes: require an authenticated user. RequireAuth wraps them
 * and redirects guests to /login with a returnTo state.
 *
 * When adding a new route, ask: "what's the smallest experience we can
 * offer without an account?" If the answer is non-trivial, add it to
 * PUBLIC_ROUTES. If the action mutates user data, leave it for
 * RequireAuth.
 */

const PUBLIC_ROUTES: ReadonlySet<string> = new Set([
	"/", // index → CandyDiscover
	"/collection",
	"/chat",
	"/hub",
	"/world",
	"/world/cockpit",
	"/world/events",
	"/impact",
	"/pricing",
	"/login",
	"/signup",
]);

const PRIVATE_ROUTES: ReadonlySet<string> = new Set([
	"/settings",
	"/settings/api-keys",
	"/account",
	"/billing",
]);

/**
 * Returns true if a guest is allowed to browse `path`.
 *
 * The order of checks matters:
 *   1. Exact private match → false
 *   2. Exact public match → true
 *   3. Catch-all unknown routes → true (the catch-all `<Navigate>` in
 *      App.tsx sends them to /collection so guests land somewhere sane
 *      instead of an empty 404).
 */
export function isGuestModeAllowed(path: string): boolean {
	if (PRIVATE_ROUTES.has(path)) return false;
	if (PUBLIC_ROUTES.has(path)) return true;
	return true;
}

/** Routes that should still render the "Guest Mode" indicator. */
export function showsGuestBadge(path: string): boolean {
	return isGuestModeAllowed(path) && path !== "/login" && path !== "/signup";
}
