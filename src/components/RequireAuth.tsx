/**
 * RequireAuth — drop-in wrapper for routes that truly need an
 * authenticated user (settings, api-keys, account, billing).
 *
 * Guest visitors see a friendly prompt instead of being redirected to
 * /login, so the discovery flow stays in one place.
 */
import { useAuth } from "@/hooks/useAuth";
import { Link, Navigate, useLocation } from "react-router-dom";

interface Props {
	children: React.ReactNode;
}

export function RequireAuth({ children }: Props) {
	const { user, loading } = useAuth();
	const location = useLocation();

	if (loading) {
		return (
			<div className="h-screen w-screen flex items-center justify-center bg-[#090a0f] text-gray-400">
				Loading...
			</div>
		);
	}

	if (!user) {
		return <Navigate to="/login" state={{ from: location.pathname }} replace />;
	}

	return <>{children}</>;
}

/**
 * Inline variant — used by guest users to gate a single action (e.g. a
 * "create new companion" button). Shows a non-blocking CTA rather than
 * navigating away.
 */
export function GuestPrompt({ action }: { action: string }) {
	return (
		<div className="mx-auto my-8 max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center text-slate-200">
			<div className="mb-2 text-2xl">🔒</div>
			<h3 className="text-lg font-semibold">Sign in to {action}</h3>
			<p className="mt-2 text-sm text-slate-400">
				Browsing is open to everyone. Create an account to {action.toLowerCase()},
				save your companions across devices, and unlock the full library.
			</p>
			<div className="mt-4 flex justify-center gap-3">
				<Link
					to="/login"
					className="rounded-xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-slate-900"
				>
					Sign in
				</Link>
				<Link
					to="/collection"
					className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
				>
					Keep browsing
				</Link>
			</div>
		</div>
	);
}
