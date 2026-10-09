import { type MeResponse, loginUrl } from "@/lib/auth";
import { useState } from "react";

interface Props {
	onAuthSuccess?: (data: MeResponse) => void;
}

export function LoginPage({ onAuthSuccess }: Props) {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [mode, setMode] = useState<"signin" | "signup">("signin");

	const API_URL =
		(import.meta as { env?: { VITE_PUBLIC_API_URL?: string } }).env?.VITE_PUBLIC_API_URL ??
		"https://api.privseai.com";

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setError(null);

		try {
			const endpoint = mode === "signin" ? "login" : "register";
			const res = await fetch(`${API_URL}/auth/${endpoint}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ email, password }),
			});

			if (!res.ok) {
				const err = await res.text();
				setError(err || "Authentication failed");
				return;
			}

			const data = (await res.json()) as MeResponse;
			onAuthSuccess?.(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Network error");
		} finally {
			setIsLoading(false);
		}
	};

	const handleOAuth = (provider: "google" | "github") => {
		window.location.href = loginUrl(provider);
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-[#090a0f] px-4">
			<div className="w-full max-w-md">
				<div className="text-center mb-8">
					<div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-pink-500 via-rose-500 to-purple-600 font-black text-white text-3xl shadow-xl shadow-pink-500/30 mb-4">
						🍬
					</div>
					<h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-rose-300 to-purple-300">
						PRIVSEAI CANDY
					</h1>
					<p className="text-sm text-gray-400 mt-2">
						{mode === "signin" ? "Sign in to your account" : "Create your account"}
					</p>
				</div>

				<div className="bg-[#12141e] border border-white/10 rounded-3xl p-8 space-y-6">
					{error && (
						<div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-sm">
							{error}
						</div>
					)}

					<form onSubmit={handleSubmit} className="space-y-5">
						<div>
							<label htmlFor="login-email" className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
							<input
								id="login-email"
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
								className="w-full px-4 py-3 bg-[#0e0f17] border border-white/10 rounded-2xl text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-pink-500/50 transition-colors"
								placeholder="you@example.com"
							/>
						</div>

						<div>
							<label htmlFor="login-password" className="block text-sm font-medium text-gray-300 mb-2">Password</label>
							<input
								id="login-password"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								className="w-full px-4 py-3 bg-[#0e0f17] border border-white/10 rounded-2xl text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-pink-500/50 transition-colors"
								placeholder="••••••••"
							/>
						</div>

						<button
							type="submit"
							disabled={isLoading}
							className="w-full py-3 rounded-2xl bg-candy-gradient text-white font-bold text-sm shadow-lg shadow-pink-500/25 hover:bg-candy-gradient-hover transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none"
						>
							{isLoading
								? mode === "signin"
									? "Signing in..."
									: "Creating account..."
								: mode === "signin"
									? "Sign In"
									: "Create Account"}
						</button>
					</form>

					<div className="relative my-6">
						<div className="absolute inset-0 flex items-center">
							<div className="w-full border-t border-white/10" />
						</div>
						<div className="relative flex justify-center text-xs text-gray-500">
							<span className="px-3 bg-[#12141e]">OR</span>
						</div>
					</div>

					<div className="space-y-3">
						<button
							type="button"
							onClick={() => handleOAuth("google")}
							className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-gray-200 font-medium text-sm transition"
						>
							<svg className="w-5 h-5" viewBox="0 0 24 24" role="img" aria-label="Google logo">
								<title>Google</title>
								<path
									fill="currentColor"
									d="M22.56 12.24c0-1.07-.09-2.09-.27-3.05 0-.04-.01-.07-.01-.11 0-1.87.66-3.51 1.7-4.82A11.4 11.4 0 0 0 12 2.05c-2.64 0-5.04.85-6.93 2.33A9.53 9.53 0 0 0 1.9 7.6c.01.07-.01.13-.01.2 0 2.28.82 4.29 2.17 5.84-.04.22-.08.44-.08.66 0 1.87.66 3.51 1.7 4.82a10.95 10.95 0 0 0 4.28 3.06c.01-.09.03-1.77.03-3.15l-.01-.67c0-1.58-.03-2.89-.03-3.24v-.01c1.19-.17 2.3-.26 3.42-.26 1.12 0 2.23.09 3.31.27.02.23.04.51.04.8 0 1.88-.01 3.71-.01 4.29 0 .15.01.3.01.45a10.92 10.92 0 0 0 3.16-3.1c1.04-1.65 1.64-3.6 1.64-5.66 0-.33-.01-.65-.01-.98.01 0-.01-.01 0-.01z"
								/>
							</svg>
							Continue with Google
						</button>
						<button
							type="button"
							onClick={() => handleOAuth("github")}
							className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-gray-200 font-medium text-sm transition"
						>
							<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" role="img" aria-label="GitHub logo">
							<title>GitHub</title>
								<path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.44 9.81 8.21 11.4.6.11.82-.26.82-.57 0-.29-.01-1.23-.02-2.24-3.34.73-4.04-1.61-4.04-1.61C4.42 18.07 3.63 17.7 3.63 17.7c-1.11-.75.08-.74.08-.74 1.22.09 1.86 1.25 1.86 1.25 1.09 1.87 2.87 1.34 3.57 1.03.11-.8.43-1.34.78-1.64-2.66-.31-5.47-1.33-5.47-5.94 0-1.31.47-2.39 1.24-3.24-.12-.31-.54-1.56.12-3.26 0 0 1.01-.32 3.31 1.23a11.51 11.51 0 013.01-.4c1.02.01 2.05.14 3.01.41 2.3-1.55 3.31-1.23 3.31-1.23.66 1.7.25 2.95.12 3.26.77.86 1.23 1.94 1.23 3.24 0 4.62-3.34 5.63-5.98 6.24.45.39.83 1.17.83 2.36 0 1.71-.02 3.09-.02 3.51 0 .31.21.68.82.56C20.56 22.77 24 18.21 24 12C24 5.37 18.63 0 12 0z" />
							</svg>
							Continue with GitHub
						</button>
					</div>

					<div className="text-center pt-4 border-t border-white/10">
						<button
							type="button"
							onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
							className="text-sm text-pink-400 hover:text-pink-300 transition"
						>
							{mode === "signin"
								? "New to PrivseAI? Create account →"
								: "Already have an account? Sign in →"}
						</button>
					</div>
				</div>

				<div className="text-center mt-6 text-xs text-gray-500">
					By continuing, you agree to our Terms of Service and Privacy Policy.
					<br />
					<label className="flex items-center justify-center gap-2 mt-2 cursor-pointer">
						<input type="checkbox" className="rounded bg-[#0e0f17] border-white/10" />I confirm I am
						18+ years old
					</label>
				</div>
			</div>
		</div>
	);
}
