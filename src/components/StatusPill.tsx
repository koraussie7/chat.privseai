export function StatusPill({
	label,
	tone = "neutral",
}: { label: string; tone?: "neutral" | "good" | "warn" }) {
	const styles = {
		neutral: "border-white/10 bg-white/[0.04] text-slate-300",
		good: "border-emerald-300/15 bg-emerald-300/[0.06] text-emerald-200",
		warn: "border-amber-300/15 bg-amber-300/[0.06] text-amber-200",
	};
	return (
		<span
			className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium ${styles[tone]}`}
		>
			<span
				className={`h-1.5 w-1.5 rounded-full ${tone === "good" ? "bg-emerald-300" : tone === "warn" ? "bg-amber-300" : "bg-slate-400"}`}
			/>
			{label}
		</span>
	);
}
