/**
 * Model presets — P2P-shareable model "recipes" (OpenPerso/NSFW-RP use case).
 *
 * A preset is a tiny JSON describing HOW to run a model locally:
 * repo, quantization, runtime command, memory requirements, NSFW flag.
 * Model FILES are never shared over P2P — each user downloads from the
 * official channel (HuggingFace). This avoids multi-GB transfers and keeps
 * licensing clean while letting companions travel with their recommended model.
 */

export type ModelPresetRuntime = "ollama" | "llamacpp" | "lmstudio" | "webllm";

export interface ModelPreset {
	id: string;
	name: string;
	hfRepo: string; // e.g. "mradermacher/Qwen3.5-text-9B-NSFW-RP-RolePlay-GGUF"
	quantization: string; // e.g. "Q4_K_M"
	runtime: ModelPresetRuntime;
	contextLength: number;
	minRamGb: number;
	isNSFW: boolean;
	description: string;
	tags: string[];
	createdAt: number;
}

const OLLAMA_BASE = "http://127.0.0.1:11434";
const LLAMACPP_BASE = "http://127.0.0.1:8080";
const LMSTUDIO_BASE = "http://127.0.0.1:1234";

/** One-line command to run this preset locally. */
export function buildRunCommand(preset: ModelPreset): string {
	const modelId = `${preset.hfRepo}:${preset.quantization}`;
	switch (preset.runtime) {
		case "ollama":
			return `ollama run hf.co/${modelId}`;
		case "llamacpp":
			return `llama-server -hf ${modelId}`;
		case "lmstudio":
			return `# Open LM Studio → Search "${preset.hfRepo}" → load ${preset.quantization} → Start Server`;
		case "webllm":
			return `# WebLLM requires MLC format, not GGUF. Use ollama/llamacpp for this GGUF preset.`;
	}
}

/** Default local base URL for the preset's runtime. */
export function defaultEndpoint(preset: ModelPreset): string {
	switch (preset.runtime) {
		case "ollama":
			return OLLAMA_BASE;
		case "llamacpp":
			return LLAMACPP_BASE;
		case "lmstudio":
			return LMSTUDIO_BASE;
		default:
			return OLLAMA_BASE;
	}
}

/** Rough device check — warns before user attempts a heavy model. */
export function estimateFitsDevice(preset: ModelPreset): { fits: boolean | null; note: string } {
	const nav = typeof navigator !== "undefined" ? navigator : undefined;
	const mem = (nav as { deviceMemory?: number } | undefined)?.deviceMemory;
	if (typeof mem !== "number" || mem <= 0) {
		return { fits: null, note: "Cannot detect device memory. This model needs ~" + preset.minRamGb + "GB RAM/VRAM." };
	}
	if (mem >= preset.minRamGb) {
		return { fits: true, note: `Detected ~${mem}GB — should be enough (needs ~${preset.minRamGb}GB).` };
	}
	return { fits: false, note: `Detected only ~${mem}GB. This model needs ~${preset.minRamGb}GB — expect poor performance or failure.` };
}

/** Validate a preset received over P2P (size/type/sanity). Never trust peers. */
export function validatePreset(raw: unknown): ModelPreset {
	const r = raw as Partial<ModelPreset>;
	const runtimes: ModelPresetRuntime[] = ["ollama", "llamacpp", "lmstudio", "webllm"];
	if (typeof r?.id !== "string" || r.id.length > 60) throw new Error("bad preset id");
	if (typeof r?.name !== "string" || r.name.length === 0 || r.name.length > 80) throw new Error("bad preset name");
	if (typeof r?.hfRepo !== "string" || !/^[\w.\-/]{3,120}$/.test(r.hfRepo)) throw new Error("bad hfRepo");
	if (typeof r?.quantization !== "string" || r.quantization.length > 20) throw new Error("bad quantization");
	if (!runtimes.includes(r.runtime as ModelPresetRuntime)) throw new Error("bad runtime");
	if (typeof r?.contextLength !== "number" || r.contextLength < 512 || r.contextLength > 262144) throw new Error("bad contextLength");
	if (typeof r?.minRamGb !== "number" || r.minRamGb < 0 || r.minRamGb > 512) throw new Error("bad minRamGb");
	if (typeof r?.isNSFW !== "boolean") throw new Error("bad isNSFW");
	if (typeof r?.description !== "string" || r.description.length > 500) throw new Error("bad description");
	if (!Array.isArray(r?.tags) || r.tags.length > 12) throw new Error("bad tags");
	return {
		id: r.id,
		name: r.name,
		hfRepo: r.hfRepo,
		quantization: r.quantization,
		runtime: r.runtime as ModelPresetRuntime,
		contextLength: r.contextLength,
		minRamGb: r.minRamGb,
		isNSFW: r.isNSFW,
		description: r.description,
		tags: r.tags.map((t) => String(t).toLowerCase().slice(0, 30)),
		createdAt: typeof r.createdAt === "number" ? r.createdAt : Date.now(),
	};
}

/** Seed catalog: shipped presets (NSFW ones gated by age verification). */
export const SEED_PRESETS: ModelPreset[] = [
	{
		id: "qwen35-9b-nsfw-rp-q4",
		name: "Qwen3.5 9B NSFW RolePlay",
		hfRepo: "mradermacher/Qwen3.5-text-9B-NSFW-RP-RolePlay-GGUF",
		quantization: "Q4_K_M",
		runtime: "ollama",
		contextLength: 32768,
		minRamGb: 8,
		isNSFW: true,
		description: "Roleplay-tuned 9B model for uncensored companion chat. Runs locally on your device.",
		tags: ["roleplay", "nsfw", "local"],
		createdAt: Date.now(),
	},
	{
		id: "qwen35-9b-rp-q5",
		name: "Qwen3.5 9B RolePlay (higher quality)",
		hfRepo: "mradermacher/Qwen3.5-text-9B-NSFW-RP-RolePlay-GGUF",
		quantization: "Q5_K_M",
		runtime: "llamacpp",
		contextLength: 32768,
		minRamGb: 9,
		isNSFW: true,
		description: "Slightly higher quality quantization of the same RP model via llama.cpp server.",
		tags: ["roleplay", "nsfw", "local"],
		createdAt: Date.now(),
	},
];
