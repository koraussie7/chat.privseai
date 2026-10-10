import { useEffect, useState } from "react";
import {
	SEED_PRESETS,
	buildRunCommand,
	defaultEndpoint,
	estimateFitsDevice,
	type ModelPreset,
} from "@/lib/model-presets";
import { useAIHub } from "@/hooks/useAIHub";
import { ageVerifier } from "@/lib/age-verification";

/**
 * Model preset catalog + attach-to-companion UI (Discover).
 * NSFW presets require age verification (existing gate).
 */
export function ModelPresetPanel() {
	const { aiHub } = useAIHub();
	const [openPreset, setOpenPreset] = useState<ModelPreset | null>(null);
	const [selectedPkg, setSelectedPkg] = useState("");
	const [notice, setNotice] = useState("");

	// Age gate: NSFW presets only for verified users
	const [isAgeVerified, setIsAgeVerified] = useState(false);
	useEffect(() => {
		let alive = true;
		ageVerifier
			.checkAge()
			.then((r) => {
				if (alive) setIsAgeVerified(Boolean(r.verified));
			})
			.catch(() => {});
		return () => {
			alive = false;
		};
	}, []);

	const presets = SEED_PRESETS.filter((p) => !p.isNSFW || isAgeVerified);

	const attach = (preset: ModelPreset) => {
		if (!selectedPkg) {
			setNotice("Choose a companion package first.");
			return;
		}
		const pkg = aiHub.getPackage(selectedPkg);
		if (!pkg) {
			setNotice("Package not found.");
			return;
		}
		const target = aiHub.getPackage(selectedPkg);
		if (!target) {
			setNotice("Package not found.");
			return;
		}
		target.metadata.recommendedModel = {
			presetId: preset.id,
			name: preset.name,
			hfRepo: preset.hfRepo,
			quantization: preset.quantization,
			runtime: preset.runtime,
		};
		setNotice(`Preset "${preset.name}" attached to ${target.metadata.name}.`);
	};

	return (
		<section className="rounded-3xl border border-white/10 bg-[#0e1017] p-5 mb-6" aria-labelledby="model-presets-title">
			<div className="mb-4">
				<h2 id="model-presets-title" className="text-lg font-bold text-white">🧠 Local Model Presets</h2>
				<p className="mt-1 text-xs text-gray-400">
					Run roleplay models on your own device. Presets share the <em>recipe</em> over P2P — never the model files.
				</p>
			</div>

			{!isAgeVerified && SEED_PRESETS.some((p) => p.isNSFW) && (
				<p className="text-[10px] text-amber-200/80 mb-3">
					Some presets are age-restricted. Verify your age in settings to see them.
				</p>
			)}

			<div className="grid gap-3 sm:grid-cols-2">
				{presets.map((preset) => {
					const fit = estimateFitsDevice(preset);
					return (
						<div key={preset.id} className="rounded-2xl border border-white/10 bg-[#13141f] p-4">
							<div className="flex items-start justify-between gap-2">
								<div>
									<h3 className="text-sm font-bold text-white">{preset.name}</h3>
									<p className="text-[10px] text-gray-500">{preset.quantization} · {preset.runtime} · ~{preset.minRamGb}GB</p>
								</div>
								{preset.isNSFW && (
									<span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">
										18+
									</span>
								)}
							</div>
							<p className="mt-2 text-xs text-gray-400">{preset.description}</p>
							<p className={`mt-1 text-[10px] ${fit.fits === false ? "text-amber-300" : "text-gray-500"}`}>
								{fit.note}
							</p>
							<button
								type="button"
								onClick={() => setOpenPreset(openPreset?.id === preset.id ? null : preset)}
								className="mt-3 w-full rounded-xl bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/15"
							>
								{openPreset?.id === preset.id ? "Hide setup" : "How to run"}
							</button>

							{openPreset?.id === preset.id && (
								<div className="mt-3 space-y-2">
									<div className="rounded-xl bg-black/40 p-2.5 font-mono text-[10px] text-emerald-300 break-all">
										{buildRunCommand(preset)}
									</div>
									<p className="text-[10px] text-gray-500">
										Then connect at <span className="font-mono">{defaultEndpoint(preset)}</span> via the Nexus badge in chat.
									</p>
									<select
										value={selectedPkg}
										onChange={(e) => setSelectedPkg(e.target.value)}
										className="w-full rounded-xl bg-[#13141f] border border-white/10 px-2 py-1.5 text-[10px] text-gray-200"
									>
										<option value="">Attach to companion…</option>
										{aiHub.getAllPackages().map((pkg) => (
											<option key={pkg.id} value={pkg.id}>{pkg.metadata.name}</option>
										))}
									</select>
									<button
										type="button"
										onClick={() => attach(preset)}
										disabled={!selectedPkg}
										className="w-full rounded-xl bg-pink-600 px-3 py-1.5 text-[10px] font-semibold text-white disabled:opacity-40"
									>
										Attach preset to companion
									</button>
								</div>
							)}
						</div>
					);
				})}
			</div>

			{notice && <p className="mt-3 text-xs text-emerald-300">{notice}</p>}
		</section>
	);
}
