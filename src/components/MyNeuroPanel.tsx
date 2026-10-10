/**
 * MyNeuroPanel — import/export my-neuro companion profiles.
 *
 * Lets a user move a character between PrivseAI and the my-neuro desktop app
 * (github.com/morettt/my-neuro) as a JSON profile. Export takes the active
 * companion; import adds the profile to localStorage so it appears in the
 * collection. No network calls — everything stays on the device.
 */
import { useRef, useState } from "react";
import {
	companionToMyNeuro,
	myNeuroToCompanion,
	validateMyNeuroProfile,
} from "@/lib/integration/MyNeuroAdapter";
import type { MyNeuroCharacterProfile } from "@/lib/integration/my-neuro-types";
import type { CandyCompanion } from "@/data/candyPresets";

interface Props {
	/** Companion to export. If omitted, export is disabled. */
	companion?: CandyCompanion | null;
	/** Called after a successful import so the parent can refresh its list. */
	onImported?: (companion: CandyCompanion) => void;
}

const STORAGE_KEY = "privsei.myneuro.imported";

function readImported(): CandyCompanion[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? (JSON.parse(raw) as CandyCompanion[]) : [];
	} catch {
		return [];
	}
}

export function MyNeuroPanel({ companion, onImported }: Props) {
	const fileRef = useRef<HTMLInputElement>(null);
	const [status, setStatus] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
	const [importing, setImporting] = useState(false);

	const handleExport = () => {
		if (!companion) {
			setStatus({ kind: "err", text: "Select a companion first." });
			return;
		}
		try {
			const profile = companionToMyNeuro(companion);
			const blob = new Blob([JSON.stringify(profile, null, 2)], {
				type: "application/json",
			});
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `${profile.id ?? companion.id}.my-neuro.json`;
			a.click();
			URL.revokeObjectURL(url);
			setStatus({ kind: "ok", text: `Exported ${companion.name}.` });
		} catch (error) {
			setStatus({
				kind: "err",
				text: error instanceof Error ? error.message : "Export failed",
			});
		}
	};

	const handleImport = async (file: File) => {
		setImporting(true);
		setStatus(null);
		try {
			const text = await file.text();
			const parsed = JSON.parse(text) as Partial<MyNeuroCharacterProfile>;
			const problems = validateMyNeuroProfile(parsed);
			if (problems.length) {
				setStatus({ kind: "err", text: `Invalid profile: ${problems.join("; ")}` });
				return;
			}
			const { companion: imported, warnings } = myNeuroToCompanion(
				parsed as MyNeuroCharacterProfile,
			);
			const full = {
				...imported,
				isPopular: false,
				isNSFW: false,
				bannerUrl: undefined,
				gallery: [],
				scenarios: [],
			} as unknown as CandyCompanion;

			const existing = readImported().filter((c) => c.id !== full.id);
			localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, full]));
			onImported?.(full);
			setStatus({
				kind: "ok",
				text: `Imported ${full.name}.${warnings.length ? ` (${warnings.join("; ")})` : ""}`,
			});
		} catch (error) {
			setStatus({
				kind: "err",
				text: error instanceof Error ? error.message : "Import failed",
			});
		} finally {
			setImporting(false);
			if (fileRef.current) fileRef.current.value = "";
		}
	};

	return (
		<div className="bg-[#12141e] border border-white/10 rounded-3xl p-6">
			<h2 className="text-lg font-bold text-white mb-1">my-neuro Interop</h2>
			<p className="text-sm text-gray-400 mb-4">
				Move a character between PrivseAI and the my-neuro desktop app as a JSON
				profile. Files stay on your device.
			</p>

			<div className="flex flex-wrap gap-3">
				<button
					type="button"
					onClick={handleExport}
					disabled={!companion}
					className="px-4 py-2.5 rounded-2xl bg-candy-gradient text-white font-semibold text-sm hover:bg-candy-gradient-hover transition disabled:opacity-40 disabled:cursor-not-allowed"
				>
					⤓ Export {companion ? companion.name : "companion"}
				</button>
				<button
					type="button"
					onClick={() => fileRef.current?.click()}
					disabled={importing}
					className="px-4 py-2.5 rounded-2xl bg-[#0e0f17] border border-white/10 text-gray-100 font-semibold text-sm hover:border-white/20 transition disabled:opacity-50"
				>
					{importing ? "Importing…" : "⤒ Import profile"}
				</button>
				<input
					ref={fileRef}
					type="file"
					accept="application/json,.json"
					className="hidden"
					onChange={(e) => {
						const file = e.target.files?.[0];
						if (file) void handleImport(file);
					}}
				/>
			</div>

			<div className="mt-6 pt-5 border-t border-white/10">
				<h3 className="text-sm font-semibold text-white mb-2">Voice (TTS)</h3>
				<p className="text-xs text-gray-500 mb-3">
					Speak replies through a local gpt-sovits server. Only enable if you have
					rights to the reference voice.
				</p>
				<label className="flex items-center gap-2 text-sm text-gray-300 mb-3">
					<input
						type="checkbox"
						defaultChecked={localStorage.getItem("privsei.tts.consent") === "true"}
						onChange={(e) => localStorage.setItem("privsei.tts.consent", String(e.target.checked))}
						className="accent-pink-500"
					/>
					I have rights to this voice (required to synthesize)
				</label>
				<input
					type="url"
					defaultValue={localStorage.getItem("privsei.tts.endpoint") ?? "http://127.0.0.1:9880"}
					onChange={(e) => localStorage.setItem("privsei.tts.endpoint", e.target.value)}
					placeholder="http://127.0.0.1:9880"
					className="w-full px-4 py-2.5 bg-[#0e0f17] border border-white/10 rounded-2xl text-gray-100 focus:outline-none focus:border-pink-500/50 transition-colors"
				/>
			</div>

			{status && (
				<div
					role="status"
					className={`mt-4 p-3 rounded-xl text-sm border ${
						status.kind === "ok"
							? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
							: "bg-rose-500/10 border-rose-500/30 text-rose-300"
					}`}
				>
					{status.text}
				</div>
			)}
		</div>
	);
}
