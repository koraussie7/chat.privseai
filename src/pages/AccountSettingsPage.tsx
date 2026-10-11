import { useAuth } from "@/hooks/useAuth";
import { ByokManager } from "@/components/ByokManager";
import { MyNeuroPanel } from "@/components/MyNeuroPanel";
import { MemosSyncPanel } from "@/components/MemosSyncPanel";
import { P2PSyncPanel } from "@/components/P2PSyncPanel";
import { useEffect, useState } from "react";

interface Props {
	onBack?: () => void;
}

const API_URL =
	(import.meta as { env?: { VITE_PUBLIC_API_URL?: string } }).env?.VITE_PUBLIC_API_URL ??
	"https://api.privseai.com";

/**
 * Room name for the P2P companion sync. Settings is account-scoped, not
 * companion-scoped — there is no `:companionId` param here — so it syncs the
 * account-wide state under one stable room id. The chat view mounts the same
 * panel per companion when a companion is open; keeping the id constant here
 * means two settings tabs on different devices pair with each other.
 */
const P2P_SYNC_COMPANION_ID = "account";

export function AccountSettingsPage({ onBack }: Props) {
	const { user, quota, loading: authLoading, refresh } = useAuth();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	const [profile, setProfile] = useState({
		name: user?.name ?? "",
		email: user?.email ?? "",
	});

	useEffect(() => {
		if (user) {
			setProfile({
				name: user.name ?? "",
				email: user.email ?? "",
			});
		}
	}, [user]);

	const handleUpdateProfile = async () => {
		setLoading(true);
		setError(null);
		setSuccess(null);
		try {
			const res = await fetch(`${API_URL}/auth/profile`, {
				method: "PATCH",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: profile.name }),
			});
			if (!res.ok) throw new Error("Failed to update profile");
			setSuccess("Profile updated successfully");
			refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Update failed");
		} finally {
			setLoading(false);
		}
	};

	const handleDeleteAccount = async () => {
		if (!confirm("Delete your account? This cannot be undone and all data will be lost.")) return;

		try {
			const res = await fetch(`${API_URL}/auth/account`, {
				method: "DELETE",
				credentials: "include",
			});
			if (!res.ok) throw new Error("Failed to delete account");
			window.location.href = "/";
		} catch (err) {
			setError(err instanceof Error ? err.message : "Action failed");
		}
	};

	if (authLoading) {
		return (
			<div className="flex-1 flex items-center justify-center py-12">
				<div className="text-gray-400">Loading...</div>
			</div>
		);
	}

	return (
		<div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-8 max-w-3xl mx-auto w-full">
			<div className="flex items-center gap-4 mb-6">
				{onBack && (
					<button
						type="button"
						onClick={onBack}
						className="px-3 py-1.5 rounded-xl bg-white/5 text-gray-300 hover:text-white text-sm transition"
					>
						← Back
					</button>
				)}
				<div>
					<h1 className="text-2xl sm:text-3xl font-extrabold text-white">⚙️ Account Settings</h1>
					<p className="text-sm text-gray-400 mt-1">
						Manage your profile, security, and preferences.
					</p>
				</div>
			</div>

			{error && (
				<div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-sm">
					{error}
				</div>
			)}

			{success && (
				<div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm">
					{success}
				</div>
			)}

			<div className="space-y-6">
				{/* Profile Section */}
				<div className="bg-[#12141e] border border-white/10 rounded-3xl p-6">
					<h2 className="text-lg font-bold text-white mb-4">Profile</h2>

					{user?.picture && (
						<div className="mb-4">
							<img
								src={user.picture}
								alt="Profile"
								className="w-16 h-16 rounded-full object-cover border border-white/10"
							/>
						</div>
					)}

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div>
							<label htmlFor="profile-name" className="block text-sm font-medium text-gray-300 mb-2">Display Name</label>
							<input
								id="profile-name"
								type="text"
								value={profile.name}
								onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
								className="w-full px-4 py-2.5 bg-[#0e0f17] border border-white/10 rounded-2xl text-gray-100 focus:outline-none focus:border-pink-500/50 transition-colors"
							/>
						</div>

						<div>
							<label htmlFor="profile-email" className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
							<input
								id="profile-email"
								type="email"
								value={profile.email}
								disabled
								className="w-full px-4 py-2.5 bg-[#0e0f17] border border-white/10 rounded-2xl text-gray-400 cursor-not-allowed"
							/>
							<div className="text-[10px] text-gray-500 mt-1">
								Contact support for email changes
							</div>
						</div>
					</div>

					<button
						type="button"
						onClick={handleUpdateProfile}
						disabled={loading}
						className="mt-4 px-4 py-2.5 rounded-2xl bg-candy-gradient text-white font-semibold text-sm hover:bg-candy-gradient-hover transition disabled:opacity-50"
					>
						{loading ? "Saving..." : "Save Changes"}
					</button>
				</div>

				{/* Quota Section */}
				{quota && (
					<div className="bg-[#12141e] border border-white/10 rounded-3xl p-6">
						<h2 className="text-lg font-bold text-white mb-4">Daily Quota</h2>
						<div className="space-y-3">
							<div>
								<div className="flex justify-between text-sm mb-1">
									<span className="text-gray-300">Messages used today</span>
									<span className="text-gray-300">
										{quota.used} / {quota.limit}
									</span>
								</div>
								<div className="w-full h-2 bg-[#0e0f17] rounded-full overflow-hidden">
									<div
										className="h-full bg-gradient-to-r from-pink-500 to-rose-500 transition-all"
										style={{
											width: `${Math.min(100, (quota.used / quota.limit) * 100)}%`,
										}}
									/>
								</div>
								<div className="text-xs text-gray-500 mt-1">
									{quota.remaining} messages remaining
								</div>
							</div>
						</div>
					</div>
				)}

				{/* BYOK Section — user's own AI provider keys (localStorage only) */}
				<ByokManager />

				{/* Security Section */}
				<div className="bg-[#12141e] border border-white/10 rounded-3xl p-6">
					<h2 className="text-lg font-bold text-white mb-4">Security</h2>
					<div className="space-y-3">
						<button
							type="button"
							onClick={() => window.location.assign("/settings/api-keys")}
							className="w-full flex items-center justify-between p-3 rounded-xl bg-[#0e0f17] border border-white/5 hover:border-white/10 text-left transition"
						>
							<span className="text-gray-200">API Keys</span>
							<span className="text-gray-500">→</span>
						</button>
						<button
							type="button"
							onClick={() => window.location.assign("/settings/billing")}
							className="w-full flex items-center justify-between p-3 rounded-xl bg-[#0e0f17] border border-white/5 hover:border-white/10 text-left transition"
						>
							<span className="text-gray-200">Billing & Subscription</span>
							<span className="text-gray-500">→</span>
						</button>
					</div>
				</div>

				{/* Danger Zone */}
				<div className="bg-rose-500/5 border border-rose-500/20 rounded-3xl p-6">
					<h2 className="text-lg font-bold text-rose-300 mb-4">Danger Zone</h2>
					<p className="text-xs text-gray-400 mb-4">
						Deleting your account will permanently remove all data, API keys, and preferences. This
						action cannot be undone.
					</p>
					<button
						type="button"
						onClick={handleDeleteAccount}
						className="px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 font-semibold hover:bg-rose-500/20 transition"
					>
						Delete Account
					</button>
				</div>

				{/* my-neuro desktop interop + long-term memory sync */}
				<MyNeuroPanel companion={null} />
				<MemosSyncPanel />

				{/* P2P multi-device sync: CRDT merge of companion state across
				    devices. Mounted here rather than in the chat view because it is
				    a settings concern, and the panel is written to stay quiet with
				    no peers instead of implying activity that isn't happening. */}
				<P2PSyncPanel companionId={P2P_SYNC_COMPANION_ID} />
			</div>
		</div>
	);
}
