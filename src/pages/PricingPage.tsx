import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

interface Props {
	onBack?: () => void;
}

const API_URL =
	(import.meta as { env?: { VITE_PUBLIC_API_URL?: string } }).env?.VITE_PUBLIC_API_URL ??
	"https://api.privseai.com";

export function PricingPage({ onBack }: Props) {
	const { user, quota } = useAuth();
	useEffect(() => {}, []);

	const plans = [
		{
			id: "free",
			name: "Free",
			price: "$0",
			description: "Basic P2P chat with daily quota",
			features: [
				"20 daily messages",
				"Basic AI companions",
				"P2P network access",
				"Community support",
			],
			current: !user,
		},
		{
			id: "pro",
			name: "Pro",
			price: "$9.99",
			description: "Enhanced chat with higher limits",
			features: [
				"Unlimited messages",
				"Priority P2P peers",
				"Voice messaging",
				"Gallery generation",
				"Early access to new models",
			],
			current: false,
		},
		{
			id: "enterprise",
			name: "Enterprise",
			price: "$29.99",
			description: "Full access for power users",
			features: [
				"Everything in Pro",
				"NSFW content unlocked",
				"Custom AI companion training",
				"P2P revenue sharing",
				"Dedicated support",
			],
			current: false,
		},
	];

	const handleCheckout = (planId: string) => {
		window.location.href = `${API_URL}/billing/checkout?plan=${planId}`;
	};

	return (
		<div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-8 max-w-5xl mx-auto w-full">
			<div className="flex items-center gap-4 mb-8">
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
					<h1 className="text-2xl sm:text-3xl font-extrabold text-white">💎 Pricing</h1>
					<p className="text-sm text-gray-400 mt-1">
						Choose your plan for the ultimate P2P AI companion experience.
					</p>
				</div>
			</div>

			{user && quota && (
				<div className="mb-8 p-4 bg-[#12141e] border border-white/10 rounded-2xl">
					<div className="flex items-center justify-between">
						<div>
							<span className="text-sm text-gray-400">Current Plan</span>
							<span className="ml-2 font-bold text-white">Free</span>
						</div>
						<div className="text-right">
							<span className="text-sm text-gray-400">Daily Quota</span>
							<span className="ml-2 text-white">
								{quota.used} / {quota.limit}
							</span>
						</div>
					</div>
				</div>
			)}

			<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
				{plans.map((plan) => (
					<div
						key={plan.id}
						className={`p-6 rounded-3xl border transition-all ${
							plan.current
								? "border-pink-500/50 bg-gradient-to-b from-pink-500/10 to-purple-500/10"
								: "border-white/10 bg-[#12141e] hover:border-white/20"
						}`}
					>
						<div className="text-center mb-6">
							<h2 className="text-xl font-bold text-white mb-2">{plan.name}</h2>
							<div className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-rose-300">
								{plan.price}
							</div>
							<p className="text-xs text-gray-400 mt-1">{plan.description}</p>
						</div>

						<div className="space-y-3 mb-6">
						{plan.features.map((feature) => (
							<div key={feature} className="flex items-center gap-2 text-sm text-gray-300">
									<span className="text-emerald-400">✓</span>
									{feature}
								</div>
							))}
						</div>

						{plan.current ? (
							<div className="text-center py-2 text-xs text-emerald-400 font-medium">
								✓ Current Plan
							</div>
						) : (
							<button
								type="button"
								onClick={() => handleCheckout(plan.id)}
								className="w-full py-2.5 rounded-2xl bg-candy-gradient text-white font-bold text-sm hover:bg-candy-gradient-hover transition transform hover:-translate-y-0.5"
							>
								Get {plan.name}
							</button>
						)}
					</div>
				))}
			</div>

			<div className="mt-12 text-center text-xs text-gray-500">
				All plans include P2P decentralized chat. No credit card required for Free.
				<br />
				Privacy-first: your data never leaves your device unless you share it.
			</div>
		</div>
	);
}
