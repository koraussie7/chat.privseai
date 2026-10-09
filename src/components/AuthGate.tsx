/**
 * AuthGate — transparent wrapper that always renders its children.
 *
 * It used to redirect unauthenticated visitors to /login, but PrivseAI
 * now allows guest mode: any visitor can browse /collection, /chat,
 * /hub (read-only), etc. without signing in. Components that genuinely
 * require authentication should wrap their sensitive parts in
 * RequireAuth (see below).
 *
 * The hook is still consumed here so child components can read the
 * current auth state and decide whether to show a "Sign in" CTA.
 */
import { useAuth } from "@/hooks/useAuth";

interface Props {
	children: React.ReactNode;
}

export function AuthGate({ children }: Props) {
	// Intentionally a pass-through now. Guest mode is the default.
	// The hook is referenced so React DevTools and future side-effects
	// stay easy to add without touching every caller.
	void useAuth();
	return <>{children}</>;
}
