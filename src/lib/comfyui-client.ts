import type { ComfyUIWorkflow, ImageAsset } from "@/types/ai-package";

export interface ComfyUIJob {
	id: string;
	promptId: string;
	workflowId: string;
	prompt: Record<string, unknown>;
	negativePrompt?: string;
	baseModel?: string;
	width?: number;
	height?: number;
	steps?: number;
	cfg?: number;
	sampler?: string;
	seed?: number;
	status: "pending" | "running" | "completed" | "failed";
	createdAt: number;
	completedAt?: number;
	image?: ImageAsset;
	error?: string;
}

export interface ComfyUIStatus {
	online: boolean;
	url?: string;
	models: string[];
}

const DEFAULT_WORKFLOW = {
	"1": {
		class_type: "CheckpointLoaderSimple",
		inputs: { ckpt_name: "" },
	},
	"2": {
		class_type: "VAEDecode",
		inputs: { vae: ["1", 2] },
	},
	"3": {
		class_type: "KSampler",
		inputs: {
			model: ["1", 0],
			seed: 0,
			steps: 20,
			cfg: 7,
			sampler_name: "euler",
			scheduler: "normal",
			denoise: 1,
			positive: ["6", 0],
			negative: ["7", 0],
			vae: ["2", 0],
		},
	},
	"4": {
		class_type: "EmptyLatentImage",
		inputs: {
			width: 512,
			height: 768,
			batch_size: 1,
		},
	},
	"5": {
		class_type: "CLIPTextEncode",
		inputs: {
			clip: ["1", 1],
			text: "",
		},
	},
	"6": {
		class_type: "ConditioningCombine",
		inputs: {
			cond1: ["5", 0],
			cond2: ["8", 0],
		},
	},
	"7": {
		class_type: "CLIPTextEncode",
		inputs: {
			clip: ["1", 1],
			text: "worst quality, low quality, normal quality",
		},
	},
	"8": {
		class_type: "CLIPTextEncode",
		inputs: {
			clip: ["1", 1],
			text: "photorealistic, high detail, best quality",
		},
	},
	"9": {
		class_type: "SaveImage",
		inputs: {
			images: ["10", 0],
		},
	},
	"10": {
		class_type: "VAEDecode",
		inputs: {
			samples: ["3", 0],
			vae: ["2", 0],
		},
	},
} as const;

export class ComfyUIClient {
	private url: string;
	private jobs: Map<string, ComfyUIJob> = new Map();
	private pollIntervals: Map<string, number> = new Map();

	constructor(url = "http://127.0.0.1:8188") {
		this.url = url;
	}

	getURL(): string {
		return this.url;
	}

	async getStatus(): Promise<ComfyUIStatus> {
		try {
			const resp = await fetch(`${this.url}/prompt`);
			if (!resp.ok) {
				return { online: false, models: [] };
			}
			const data = (await resp.json()) as {
				models?: string[];
				last_node_id?: string;
				last_queued_change_id?: number;
			};
			return {
				online: true,
				url: this.url,
				models: data.models ?? [],
			};
		} catch {
			return { online: false, models: [] };
		}
	}

	/**
	 * Submit a workflow to ComfyUI for image generation.
	 * Returns a job that will be polled for completion.
	 */
	async submitWorkflow(workflow: ComfyUIWorkflow): Promise<ComfyUIJob> {
		const promptId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
		const jobId = `comfy-${promptId}`;

		const job: ComfyUIJob = {
			id: jobId,
			promptId,
			workflowId: workflow.id,
			prompt: workflow.workflowJson,
			negativePrompt: workflow.lastNegativePrompt,
			baseModel: workflow.baseModel,
			width: workflow.width,
			height: workflow.height,
			steps: workflow.steps,
			cfg: workflow.cfg,
			sampler: workflow.sampler,
			seed: workflow.seed,
			status: "pending",
			createdAt: Date.now(),
		};

		try {
			const resp = await fetch(`${this.url}/prompt`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ prompt: workflow.workflowJson }),
			});

			if (!resp.ok) {
				job.status = "failed";
				job.error = `ComfyUI responded ${resp.status}`;
				this.jobs.set(jobId, job);
				return job;
			}

			const result = (await resp.json()) as {
				prompt_id: string;
				ws_token_1?: string;
			};

			job.promptId = result.prompt_id;
			job.status = "running";
			this.jobs.set(jobId, job);
			this._startPolling(jobId);
			return job;
		} catch (err) {
			job.status = "failed";
			job.error = err instanceof Error ? err.message : "Connection failed";
			this.jobs.set(jobId, job);
			return job;
		}
	}

	/**
	 * Create a workflow from a text prompt and style preset settings.
	 */
	createWorkflowFromPrompt(
		workflowId: string,
		name: string,
		opts: {
			prompt: string;
			negativePrompt?: string;
			model?: string;
			width?: number;
			height?: number;
			steps?: number;
			cfg?: number;
			sampler?: string;
			seed?: number;
		},
	): ComfyUIWorkflow {
		const seed = opts.seed ?? Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
		const positiveText = `${opts.prompt}${opts.negativePrompt ? "" : ", best quality, masterpiece, photorealistic"}`;
		const negativeText =
			opts.negativePrompt ?? "worst quality, low quality, normal quality, blurry, jpeg artifacts";

		const workflow = JSON.parse(JSON.stringify(DEFAULT_WORKFLOW));

		workflow["1"].inputs.ckpt_name = opts.model ?? "sd_xl_base_1.0.safetensors";
		workflow["4"].inputs.width = opts.width ?? 512;
		workflow["4"].inputs.height = opts.height ?? 768;
		workflow["3"].inputs.seed = seed;
		workflow["3"].inputs.steps = opts.steps ?? 20;
		workflow["3"].inputs.cfg = opts.cfg ?? 7;
		workflow["3"].inputs.sampler_name = opts.sampler ?? "euler";
		workflow["5"].inputs.text = positiveText;
		workflow["7"].inputs.text = negativeText;

		return {
			id: workflowId,
			name,
			workflowJson: workflow,
			lastPrompt: opts.prompt,
			lastNegativePrompt: negativeText,
			baseModel: opts.model || "sd_xl_base_1.0",
			width: opts.width ?? 512,
			height: opts.height ?? 768,
			steps: opts.steps ?? 20,
			cfg: opts.cfg ?? 7,
			sampler: opts.sampler ?? "euler",
			seed,
		};
	}

	/**
	 * Get job status by ID.
	 */
	getJob(jobId: string): ComfyUIJob | undefined {
		return this.jobs.get(jobId);
	}

	/**
	 * Poll a job until completion.
	 */
	async waitForJob(jobId: string, timeoutMs = 60000): Promise<ComfyUIJob> {
		const start = Date.now();

		while (Date.now() - start < timeoutMs) {
			const job = this.jobs.get(jobId);
			if (!job) {
				throw new Error(`Job ${jobId} not found`);
			}

			if (job.status === "completed" || job.status === "failed") {
				this._stopPolling(jobId);
				return job;
			}

			await new Promise((resolve) => setTimeout(resolve, 500));
		}

		this._stopPolling(jobId);
		const job = this.jobs.get(jobId);
		if (job) {
			job.status = "failed";
			job.error = "Timeout waiting for ComfyUI result";
			return job;
		}
		const failedJob: ComfyUIJob = {
			id: jobId,
			promptId: "",
			workflowId: "",
			prompt: {},
			status: "failed",
			createdAt: Date.now(),
			error: "Timeout waiting for ComfyUI result",
		};
		return failedJob;
	}

	/**
	 * Get generated images for a completed job.
	 */
	async getJobImages(jobId: string): Promise<ImageAsset[]> {
		const job = this.jobs.get(jobId);
		if (!job || job.status !== "completed") return [];
		if (job.image) return [job.image];
		return [];
	}

	/**
	 * Delete a workflow (interrupt + cleanup).
	 */
	async deleteJob(jobId: string): Promise<void> {
		this._stopPolling(jobId);
		const job = this.jobs.get(jobId);
		if (!job || job.status !== "running") {
			this.jobs.delete(jobId);
			return;
		}

		try {
			await fetch(`${this.url}/interrupt`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ prompt_id: job.promptId }),
			});
		} catch {
			// ignore
		}

		this.jobs.delete(jobId);
	}

	/**
	 * Upload an image to ComfyUI for img2img or as a reference.
	 */
	async uploadImage(file: File): Promise<{ name: string } | null> {
		try {
			const form = new FormData();
			form.append("image", file);

			const resp = await fetch(`${this.url}/upload/image`, {
				method: "POST",
				body: form,
			});

			if (!resp.ok) return null;
			return (await resp.json()) as { name: string };
		} catch {
			return null;
		}
	}

	private _startPolling(jobId: string): void {
		const interval = window.setInterval(() => {
			this._checkJob(jobId).catch(() => {});
		}, 1000);
		this.pollIntervals.set(jobId, interval);
	}

	private _stopPolling(jobId: string): void {
		const interval = this.pollIntervals.get(jobId);
		if (interval) {
			clearInterval(interval);
			this.pollIntervals.delete(jobId);
		}
	}

	private async _checkJob(jobId: string): Promise<void> {
		const job = this.jobs.get(jobId);
		if (!job || job.status !== "running") return;

		try {
			const resp = await fetch(`${this.url}/history/${job.promptId}`);
			if (!resp.ok) return;

			const history = (await resp.json()) as Record<
				string,
				{
					status?: string;
					outputs?: Record<string, { images?: string[] }>;
				}
			>;

			const entry = history[job.promptId];
			if (!entry) return;

			if (entry.status === "completed") {
				const imageName = entry.outputs?.["9"]?.images?.[0];
				if (imageName) {
					const imageUrl = `${this.url}/view?filename=${imageName}&type=generated_image`;
					job.image = {
						id: `img-${Date.now()}`,
						url: imageUrl,
						thumbnailUrl: imageUrl,
						title: job.workflowId,
						description: job.negativePrompt ?? "",
						prompt: job.negativePrompt ?? "",
						model: job.baseModel ?? "unknown",
						width: job.width,
						height: job.height,
						seed: job.seed,
						steps: job.steps,
						cfg: job.cfg,
						sampler: job.sampler,
						generatedAt: Date.now(),
						workflowId: job.workflowId,
					};
				}
				job.status = "completed";
				job.completedAt = Date.now();
				this._stopPolling(jobId);
			} else if (entry.status === "error") {
				job.status = "failed";
				job.error = "ComfyUI reported an error";
				this._stopPolling(jobId);
			}
		} catch {
			// Polling continues on transient errors
		}
	}
}

export { DEFAULT_WORKFLOW };

const NSFW_WORKFLOW = {
	"1": {
		class_type: "CheckpointLoaderSimple",
		inputs: { ckpt_name: "nsfwRealisticVisionV6.safetensors" },
	},
	"2": {
		class_type: "VAEDecode",
		inputs: { vae: ["1", 2] },
	},
	"3": {
		class_type: "KSampler",
		inputs: {
			model: ["1", 0],
			seed: 0,
			steps: 30,
			cfg: 7,
			sampler_name: "dpmpp_2m",
			scheduler: "normal",
			denoise: 1,
			positive: ["5", 0],
			negative: ["7", 0],
			vae: ["2", 0],
		},
	},
	"4": {
		class_type: "EmptyLatentImage",
		inputs: { width: 512, height: 768, batch_size: 1 },
	},
	"5": {
		class_type: "CLIPTextEncode",
		inputs: {
			clip: ["1", 1],
			text: "photorealistic, detailed, 18+, sensual pose",
		},
	},
	"7": {
		class_type: "CLIPTextEncode",
		inputs: {
			clip: ["1", 1],
			text: "worst quality, low quality, blurry, watermark, text, username, deformed",
		},
	},
	"10": {
		class_type: "VAEDecode",
		inputs: { samples: ["3", 0], vae: ["2", 0] },
	},
	"11": {
		class_type: "SaveImage",
		inputs: { images: ["10", 0] },
	},
} as const;

const VIDEO_WORKFLOW = {
	"1": {
		class_type: "CheckpointLoaderSimple",
		inputs: { ckpt_name: "realisticVisionV6.safetensors" },
	},
	"2": {
		class_type: "VAEDecode",
		inputs: { vae: ["1", 2] },
	},
	"3": {
		class_type: "KSampler",
		inputs: {
			model: ["1", 0],
			seed: 0,
			steps: 20,
			cfg: 7,
			sampler_name: "euler",
			scheduler: "normal",
			denoise: 1,
			positive: ["5", 0],
			negative: ["6", 0],
			vae: ["2", 0],
		},
	},
	"4": {
		class_type: "EmptyLatentImage",
		inputs: { width: 480, height: 640, batch_size: 1 },
	},
	"5": {
		class_type: "CLIPTextEncode",
		inputs: { clip: ["1", 1], text: "" },
	},
	"6": {
		class_type: "CLIPTextEncode",
		inputs: {
			clip: ["1", 1],
			text: "worst quality, low quality, normal quality",
		},
	},
	"10": {
		class_type: "VAEDecode",
		inputs: { samples: ["3", 0], vae: ["2", 0] },
	},
	"11": {
		class_type: "SaveImage",
		inputs: { images: ["10", 0] },
	},
	"12": {
		class_type: "VHS_VideoCombine",
		inputs: {
			images: ["10", 0],
			frame_rate: 8,
			duration: 5,
			output_file: "output.mp4",
		},
	},
} as const;

export { NSFW_WORKFLOW, VIDEO_WORKFLOW };
