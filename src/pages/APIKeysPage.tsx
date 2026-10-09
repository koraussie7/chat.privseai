import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";

interface ApiKey {
	id: string;
	name: string;
	key: string;
	createdAt: number;
	lastUsed?: number;
	expiresAt?: number;
}

interface Props {
	onBack?: () => void;
}

const API_URL =
	(import.meta as { env?: { VITE_PUBLIC_API_URL?: string } }).env?.VITE_PUBLIC_API_URL ??
	"https://api.privseai.com";

export function APIKeysPage({ onBack }: Props) {
	const { loading: authLoading } = useAuth();
	const [keys, setKeys] = useState<ApiKey[]>([]);
	const [loading, setLoading] = useState(true);
	const [newKeyName, setNewKeyName] = useState("");
	const [creating, setCreating] = useState(false);
	const [newKey, setNewKey] = useState<ApiKey | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		fetchKeys();
	}, []);

	const fetchKeys = async () => {
		setLoading(true);
		try {
			const res = await fetch(`${API_URL}/v1/api-keys`, {
				credentials: "include",
			});
			if (!res.ok) throw new Error("Failed to fetch keys");
			const data = await res.json();
			setKeys(data.keys ?? []);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load");
		} finally {
			setLoading(false);
		}
	};

	const handleCreate = async () => {
		if (!newKeyName.trim()) return;
		setCreating(true);
		setError(null);
		try {
			const res = await fetch(`${API_URL}/v1/api-keys`, {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: newKeyName }),
			});
			if (!res.ok) throw new Error("Failed to create key");
			const data = await res.json();
			setNewKey(data.key as ApiKey);
			setNewKeyName("");
			fetchKeys();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create");
		} finally {
			setCreating(false);
		}
	};

	const handleDelete = async (id: string) => {
		if (!confirm("Delete this API key?")) return;
		try {
			const res = await fetch(`${API_URL}/v1/api-keys/${id}`, {
				method: "DELETE",
				credentials: "include",
			});
			if (!res.ok) throw new Error("Failed to delete");
			setKeys((prev) => prev.filter((k) => k.id !== id));
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to delete");
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
		<div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-8 max-w-4xl mx-auto w-full">
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
					<h1 className="text-2xl sm:text-3xl font-extrabold text-white">🔑 API Keys</h1>
					<p className="text-sm text-gray-400 mt-1">
						Manage your API keys for programmatic access to PrivseAI.
					</p>
				</div>
			</div>

			{error && (
				<div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-sm">
					{error}
				</div>
			)}

			{newKey && (
				<div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
					<div className="text-xs text-amber-300 uppercase font-semibold mb-2">
						New API Key Created!
					</div>
					<div className="font-mono text-sm text-white break-all bg-[#0e0f17] p-3 rounded-xl border border-white/5 mb-2">
						{newKey.key}
					</div>
					<button
						type="button"
						onClick={() => {
							navigator.clipboard.writeText(newKey.key);
						}}
						className="text-xs text-amber-300 hover:text-amber-200"
					>
						📋 Copy to clipboard
					</button>
					<div className="text-xs text-gray-500 mt-2">
						Store this key securely. It won't be shown again.
					</div>
				</div>
			)}

			<div className="bg-[#12141e] border border-white/10 rounded-3xl p-6 mb-6">
				<h2 className="text-lg font-bold text-white mb-4">Create New Key</h2>
				<div className="flex gap-3">
					<input
						type="text"
						value={newKeyName}
						onChange={(e) => setNewKeyName(e.target.value)}
						placeholder="Key description (e.g. 'My App')"
						className="flex-1 px-4 py-2.5 bg-[#0e0f17] border border-white/10 rounded-2xl text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-pink-500/50 transition-colors"
					/>
					<button
						type="button"
						onClick={handleCreate}
						disabled={!newKeyName.trim() || creating}
						className="px-4 py-2.5 rounded-2xl bg-candy-gradient text-white font-semibold text-sm hover:bg-candy-gradient-hover transition disabled:opacity-50"
					>
						{creating ? "Creating..." : "Create"}
					</button>
				</div>
			</div>

			<div className="space-y-3">
				<h2 className="text-lg font-bold text-white mb-3">Your API Keys</h2>
				{loading ? (
					<div className="text-gray-400 py-8 text-center">Loading keys...</div>
				) : keys.length === 0 ? (
					<div className="text-center py-12 text-gray-400">
						<div className="text-3xl mb-2">🔐</div>
						<p>No API keys yet.</p>
						Create one above to get started.
					</div>
				) : (
					keys.map((key) => (
						<div
							key={key.id}
							className="flex items-center justify-between p-4 bg-[#12141e] border border-white/10 rounded-2xl"
						>
							<div className="flex-1 min-w-0">
								<div className="font-medium text-white">{key.name}</div>
								<div className="text-xs text-gray-500 mt-1 font-mono">
									{key.key.slice(0, 8)}••••••••••••{key.key.slice(-4)}
								</div>
								<div className="text-[10px] text-gray-500 mt-1">
									Created {new Date(key.createdAt).toLocaleDateString()}
									{key.lastUsed && ` · Last used ${new Date(key.lastUsed).toLocaleDateString()}`}
								</div>
							</div>
							<button
								type="button"
								onClick={() => handleDelete(key.id)}
								className="ml-3 px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 font-medium text-sm transition"
								title="Delete key"
							>
								🗑
							</button>
						</div>
					))
				)}
			</div>
		</div>
	);
}
