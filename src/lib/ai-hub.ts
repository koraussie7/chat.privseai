/**
 * AI Hub core logic for privseai.com.
 *
 * Manages the lifecycle of AI Packages: creation, cloning, forking (remixing),
 * and P2P distribution via Trystero. Packages are serialized to JSON and
 * shared over the "ai-package" Trystero action, with model chunks distributed
 * via the existing ModelDistributor infrastructure.
 *
 * Key concepts:
 *  - AI Creator: publishes packages to the P2P network
 *  - Clone: 1-click import of a package (no ownership transfer)
 *  - Remix/Fork: create a derivative package with your own edits
 *  - Share via Trystero: broadcast package metadata to peers, request full
 *    model download through ModelDistributor
 */

import type { CompanionProfile } from "@/components/CompanionChat";
import { CharacterCardParser } from "@/lib/character-card";
import { ComfyUIClient, NSFW_WORKFLOW, VIDEO_WORKFLOW } from "@/lib/comfyui-client";
import { ModelDistributor } from "@/lib/model-distributor";
import type { TrysteroP2PClient } from "@/lib/trystero-client";
import type {
	AIHubStats,
	AIPackage,
	AIPackageConfig,
	AIPackageExport,
	AIPackageMedia,
	AIPackageMetadata,
	ComfyUIWorkflow,
	ForkRecord,
	GalleryItem,
	ImageAsset,
	MCPToolRef,
	ShareResult,
	StylePreset,
	TrendingAIPackage,
	VideoAsset,
} from "@/types/ai-package";
import type { CharacterCard } from "@/types/character";

const AI_PACKAGE_ACTION = "ai-package";

const DEFAULT_CONFIG: AIPackageConfig = {
	systemPrompt: "",
	maxTokens: 2048,
	temperature: 0.7,
	topP: 0.9,
	frequencyPenalty: 0.3,
	presencePenalty: 0.3,
	mindToolsEnabled: false,
	mindDailyTokens: 5000,
	mindToolCallsPerDay: 8,
};

const DEFAULT_MEDIA: AIPackageMedia = {
	avatarUrl: "",
	gallery: [],
};

const DEFAULT_MCP_TOOLS: MCPToolRef[] = [
	{
		id: "memory",
		name: "Memory",
		url: "mcp://memory",
		description: "Persistent memory for the companion",
	},
	{
		id: "travel",
		name: "Travel",
		url: "mcp://travel",
		description: "Travel information and booking",
	},
	{
		id: "restaurant",
		name: "Restaurant",
		url: "mcp://restaurant",
		description: "Restaurant recommendations",
	},
	{
		id: "prompts-chat",
		name: "Prompts.Chat",
		url: "mcp://prompts.chat",
		icon: "📚",
		description:
			"Public domain prompt library — 143k+ curated prompts for AI chat models. Provides prompt discovery and categories.",
	},
	{
		id: "spicyapi",
		name: "SpicyAPI",
		url: "mcp://spicyapi",
		icon: "🔞",
		description:
			"NSFW image/video/voice generation via Spicy API MCP server. Use sandbox keys for free testing. 18+ only.",
	},
];

export class AIHub {
	private packages = new Map<string, AIPackage>();
	private forks = new Map<string, ForkRecord>();
	private client: TrysteroP2PClient | null = null;
	private unsubscribePackage: (() => void) | null = null;
	private distributor = new ModelDistributor();
	private comfyui: ComfyUIClient | null = null;
	private trendingScores = new Map<string, number>();
	private packagePeers = new Map<string, Set<string>>();
	private stylePresets = new Map<string, StylePreset>();
	private workflows = new Map<string, ComfyUIWorkflow>();
	private imageAssets = new Map<string, ImageAsset>();

	private genId(): string {
		return typeof crypto !== "undefined" && crypto.randomUUID
			? crypto.randomUUID()
			: `${Date.now()}-${Math.random().toString(36).slice(2)}`;
	}

	getAllPackages(): AIPackage[] {
		return Array.from(this.packages.values()).sort((a, b) => {
			const ta = this.trendingScores.get(a.id) ?? 0;
			const tb = this.trendingScores.get(b.id) ?? 0;
			return tb - ta;
		});
	}

	getPackage(id: string): AIPackage | undefined {
		return this.packages.get(id);
	}

	loadPackage(pkg: AIPackage): void {
		this.packages.set(pkg.id, pkg);
	}

	loadPackages(pkgs: AIPackage[]): void {
		for (const pkg of pkgs) {
			if (pkg?.id) this.packages.set(pkg.id, pkg);
		}
	}

	getTrendingPackages(): TrendingAIPackage[] {
		return this.getAllPackages().map((pkg) => {
			const peers = this.packagePeers.get(pkg.id);
			return {
				...pkg,
				trendingScore: this.trendingScores.get(pkg.id) ?? 0,
				peersWithModel: peers?.size ?? 0,
				lastActivePeer: peers ? Array.from(peers)[0] : undefined,
			};
		});
	}

	getStats(): AIHubStats {
		return {
			totalPackages: this.packages.size,
			totalPeers: this.client ? this.client.getNetworkState().peerCount : 0,
			cachedModels: this.distributor.cachedModelCount,
			totalDownloads: Array.from(this.packages.values()).reduce(
				(sum, p) => sum + (p.metadata.downloadCount ?? 0),
				0,
			),
		};
	}

	setClient(client: TrysteroP2PClient): void {
		if (this.client === client && this.unsubscribePackage) return;
		this.unsubscribePackage?.();
		this.client = client;
		this.distributor.setClient(client);
		if (typeof client.onAIPackage === "function") {
			this.unsubscribePackage = client.onAIPackage((data, peerId) => {
				const incoming = data as AIPackage;
				if (incoming?.id && incoming.spec === "ai-package-v1") {
					this._receivePackage(incoming, peerId);
				}
			});
		} else {
			const room = (
				client as unknown as {
					room?: {
						makeAction: (id: string) => {
							onMessage: ((data: unknown, ctx: { peerId: string }) => void) | null;
						};
					};
				}
			).room;
			if (room) {
				const action = room.makeAction(AI_PACKAGE_ACTION);
				action.onMessage = (data, { peerId }) => {
					const incoming = data as AIPackage;
					if (incoming?.id && incoming.spec === "ai-package-v1") {
						this._receivePackage(incoming, peerId);
					}
				};
			}
		}
	}

	/**
	 * Create a new AI Package from a character card and optional overrides.
	 */
	createPackage(opts: {
		card: CharacterCard;
		name?: string;
		description?: string;
		creator: string;
		baseModel?: string;
		tools?: MCPToolRef[];
		media?: Partial<AIPackageMedia>;
		config?: Partial<AIPackageConfig>;
		tags?: string[];
		category?: AIPackageMetadata["category"];
	}): AIPackage {
		if (!opts.card.data.name) {
			throw new Error("Character card must have a name");
		}

		const now = Date.now();

		const metadata: AIPackageMetadata = {
			name: opts.name ?? opts.card.data.name,
			description: opts.description ?? opts.card.data.description ?? "",
			version: "1.0.0",
			creator: opts.creator,
			creatorAvatar: opts.media?.creatorAvatar,
			baseModel: opts.baseModel ?? "Qwen3-0.6B",
			quantization: "Q4_K_M",
			parameters: "0.6B",
			createdAt: now,
			updatedAt: now,
			tags: opts.tags ?? [],
			category: opts.category ?? "realistic",
			isPublic: false,
			isLive: false,
			downloadCount: 0,
			likeCount: 0,
			forks: 0,
			language: "en",
		};

		const mergedConfig: AIPackageConfig = {
			...DEFAULT_CONFIG,
			systemPrompt: opts.config?.systemPrompt ?? opts.card.data.system_prompt ?? "",
			...opts.config,
		};

		const media: AIPackageMedia = {
			...DEFAULT_MEDIA,
			avatarUrl: opts.media?.avatarUrl ?? opts.card.data.src ?? "",
			gallery: opts.media?.gallery ?? [],
			vrmModel: opts.media?.vrmModel ?? (opts.card.data.extensions?.vrm as string | undefined),
		};

		const pkg: AIPackage = {
			id: this.genId(),
			spec: "ai-package-v1",
			metadata,
			card: opts.card,
			config: mergedConfig,
			tools: opts.tools ?? DEFAULT_MCP_TOOLS,
			media,
		};

		this.packages.set(pkg.id, pkg);
		this._publishLocal(pkg);
		return pkg;
	}

	/**
	 * Clone a package: local copy without attribution to original.
	 */
	clonePackage(
		source: AIPackage,
		overrides: {
			name?: string;
			creator?: string;
			tags?: string[];
		} = {},
	): AIPackage {
		if (!source.id) {
			throw new Error("Cannot clone: source package has no ID");
		}

		const cloned = this._deepClonePackage(source);

		cloned.id = this.genId();
		cloned.metadata.name = overrides.name ?? source.metadata.name;
		cloned.metadata.creator = overrides.creator ?? "You";
		cloned.metadata.createdAt = Date.now();
		cloned.metadata.updatedAt = Date.now();
		cloned.metadata.downloadCount = 0;
		cloned.metadata.likeCount = 0;
		cloned.metadata.forks = 0;
		cloned.metadata.isPublic = false;
		cloned.downloadCid = undefined;
		cloned.signature = undefined;
		cloned.forkedFrom = undefined;

		if (overrides.tags) {
			cloned.metadata.tags = overrides.tags;
		}

		this.packages.set(cloned.id, cloned);
		this._publishLocal(cloned);
		return cloned;
	}

	/**
	 * Fork/remix a package: creates a derivative with attribution to the original.
	 * The forked package starts as an exact copy that can be edited.
	 */
	forkPackage(
		source: AIPackage,
		creator: string,
		overrides: {
			name?: string;
			description?: string;
			systemPrompt?: string;
			tags?: string[];
			tools?: MCPToolRef[];
		} = {},
	): AIPackage {
		if (!source.id) {
			throw new Error("Cannot fork: source package has no ID");
		}

		const forked = this._deepClonePackage(source);

		forked.id = this.genId();
		forked.metadata.name = overrides.name ?? `${source.metadata.name} (Remix)`;
		forked.metadata.description = overrides.description ?? source.metadata.description;
		forked.metadata.creator = creator;
		forked.metadata.version = "1.0.0-fork";
		forked.metadata.createdAt = Date.now();
		forked.metadata.updatedAt = Date.now();
		forked.metadata.downloadCount = 0;
		forked.metadata.forks = 0;
		forked.metadata.isPublic = false;
		forked.forkedFrom = {
			id: source.id,
			name: source.metadata.name,
			forkId: forked.id,
			forkedAt: Date.now(),
		};
		forked.downloadCid = undefined;
		forked.signature = undefined;

		if (overrides.systemPrompt !== undefined) {
			forked.config.systemPrompt = overrides.systemPrompt;
		}
		if (overrides.tags) {
			forked.metadata.tags = [...source.metadata.tags, ...overrides.tags];
		}
		if (overrides.tools) {
			forked.tools = overrides.tools;
		}

		source.metadata.forks = (source.metadata.forks ?? 0) + 1;

		this.forks.set(forked.id, {
			id: forked.id,
			fromPackageId: source.id,
			fromForkId: source.forkedFrom?.forkId ?? source.id,
			package: forked,
			forkedAt: Date.now(),
			forkedBy: creator,
		});

		this.packages.set(forked.id, forked);
		this._publishLocal(forked);
		return forked;
	}

	/**
	 * Export a package to a shareable JSON blob (for manual download/share).
	 */
	exportPackage(pkg: AIPackage): AIPackageExport {
		return {
			package: this._deepClonePackage(pkg),
			exportedAt: Date.now(),
			exportedBy: pkg.metadata.creator,
		};
	}

	/**
	 * Import a package from an exported JSON blob.
	 */
	importPackage(exported: AIPackageExport): AIPackage {
		const pkg = this._deepClonePackage(exported.package);
		pkg.id = this.genId();
		pkg.metadata.updatedAt = Date.now();
		this.packages.set(pkg.id, pkg);
		this._publishLocal(pkg);
		return pkg;
	}

	/**
	 * Share a package over Trystero P2P. Broadcasts package metadata to all peers.
	 * The full model is distributed lazily via ModelDistributor on demand.
	 */
	async sharePackage(pkg: AIPackage): Promise<ShareResult> {
		if (!this.client) {
			return { success: false, error: "No P2P connection" };
		}
		if (this.client.getNetworkState().peerCount === 0) {
			return { success: false, error: "No P2P peers are currently connected" };
		}

		const serializable = this._serializeForNetwork(pkg);
		const json = JSON.stringify(serializable);
		const bytesSent = new TextEncoder().encode(json).length;

		try {
			if (typeof this.client.broadcastAIPackage === "function") {
				this.client.broadcastAIPackage(serializable);
			} else {
				const room = (
					this.client as unknown as {
						room?: {
							makeAction: (id: string) => {
								send: (data: unknown, opts?: unknown) => void;
							};
						};
					}
				).room;
				if (!room)
					return {
						success: false,
						error: "P2P client does not support AI package sharing",
					};
				room.makeAction(AI_PACKAGE_ACTION).send(serializable, {});
			}
			pkg.metadata.publishedAt = Date.now();
			pkg.metadata.isPublic = true;
			this._publishLocal(pkg);

			const peers = Array.from(this.client.getNetworkState().peers);

			return {
				success: true,
				peerId: peers[0]?.id,
				bytesSent,
			};
		} catch (err) {
			return {
				success: false,
				error: err instanceof Error ? err.message : "Share failed",
				bytesSent,
			};
		}
	}

	/**
	 * Request a package from a specific peer.
	 */
	async requestPackage(peerId: string, packageId: string): Promise<AIPackage | null> {
		return new Promise((resolve) => {
			const room = (
				this.client as unknown as {
					room?: {
						makeAction: (id: string) => {
							request: (data: unknown, opts: unknown) => Promise<unknown>;
						};
					};
				}
			)?.room;
			if (!room) {
				resolve(null);
				return;
			}

			const queryAction = room.makeAction("ai-package-request");
			const response = queryAction.request({ packageId }, { target: peerId, timeoutMs: 15000 });

			response
				.then((data: unknown) => {
					if (data && typeof data === "object" && "package" in data) {
						const pkg = (data as { package: AIPackage }).package;
						this._receivePackage(pkg, peerId);
						resolve(pkg);
					} else {
						resolve(null);
					}
				})
				.catch(() => resolve(null));
		});
	}

	/**
	 * Build a CandyCompanion-compatible profile from an AIPackage.
	 */
	packageToProfile(pkg: AIPackage): CompanionProfile & {
		personality: string[];
		hobbies: string[];
		stage: number;
	} {
		const profile = CharacterCardParser.cardToProfile(pkg.card);
		return {
			...profile,
			personality: pkg.card.data.personality
				.split(/[\n,]/)
				.map((item) => item.trim())
				.filter(Boolean),
			hobbies: (pkg.card.data.tags ?? []).filter(Boolean).slice(0, 4),
			stage:
				typeof pkg.card.data.extensions.stage === "number"
					? pkg.card.data.extensions.stage
					: (profile.stage ?? 2),
		};
	}

	receivePackage(pkg: AIPackage, peerId: string): void {
		if (!pkg?.id || pkg.spec !== "ai-package-v1") return;
		this._receivePackage(pkg, peerId);
	}

	private _receivePackage(pkg: AIPackage, peerId: string): void {
		let existing = this.packages.get(pkg.id);

		if (!existing) {
			existing = this._deepClonePackage(pkg);
			const peers = this.packagePeers.get(pkg.id) ?? new Set();
			peers.add(peerId);
			this.packagePeers.set(pkg.id, peers);

			this.trendingScores.set(pkg.id, (this.trendingScores.get(pkg.id) ?? 0) + 1);

			this.packages.set(pkg.id, existing);
		} else {
			const peers = this.packagePeers.get(pkg.id) ?? new Set();
			peers.add(peerId);
			this.packagePeers.set(pkg.id, peers);
		}
	}

	private _publishLocal(pkg: AIPackage): void {
		pkg.metadata.updatedAt = Date.now();
		this.packages.set(pkg.id, pkg);
	}

	private _deepClonePackage(pkg: AIPackage): AIPackage {
		return JSON.parse(JSON.stringify(pkg)) as AIPackage;
	}

	private _serializeForNetwork(pkg: AIPackage): AIPackage {
		return this._deepClonePackage(pkg);
	}

	// ---- ComfyUI integration ----

	setComfyUIClient(client: ComfyUIClient): void {
		this.comfyui = client;
	}

	getComfyUIClient(): ComfyUIClient | null {
		return this.comfyui;
	}

	setComfyUIUrl(url: string): void {
		this.comfyui = new ComfyUIClient(url);
	}

	async getComfyUIStatus() {
		if (!this.comfyui) return { online: false, models: [] };
		return this.comfyui.getStatus();
	}

	/**
	 * Create a style preset for character image generation.
	 */
	createStylePreset(opts: {
		name: string;
		description: string;
		promptTemplate: string;
		negativePrompt?: string;
		model?: string;
		width?: number;
		height?: number;
		steps?: number;
		cfg?: number;
		sampler?: string;
		previewUrls?: string[];
		tags?: string[];
		isPublic?: boolean;
	}): StylePreset {
		const style: StylePreset = {
			id: this.genId(),
			name: opts.name,
			description: opts.description,
			promptTemplate: opts.promptTemplate,
			negativePrompt: opts.negativePrompt,
			model: opts.model,
			width: opts.width,
			height: opts.height,
			steps: opts.steps,
			cfg: opts.cfg,
			sampler: opts.sampler,
			previewUrls: opts.previewUrls,
			tags: opts.tags ?? [],
			isPublic: opts.isPublic ?? false,
		};
		this.stylePresets.set(style.id, style);
		return style;
	}

	getAllStylePresets(): StylePreset[] {
		return Array.from(this.stylePresets.values());
	}

	getStylePreset(id: string): StylePreset | undefined {
		return this.stylePresets.get(id);
	}

	/**
	 * Create a NSFW style preset for adult image generation.
	 * Requires age verification to use.
	 */
	createNSFWStylePreset(opts: {
		name: string;
		promptTemplate: string;
		negativePrompt?: string;
		model?: string;
		width?: number;
		height?: number;
		steps?: number;
		cfg?: number;
		tags?: string[];
		isPublic?: boolean;
	}): StylePreset {
		const style: StylePreset = {
			id: this.genId(),
			name: opts.name,
			description: "NSFW style preset — age verification required",
			promptTemplate: opts.promptTemplate,
			negativePrompt: opts.negativePrompt,
			model: opts.model ?? "nsfwRealisticVisionV6.safetensors",
			width: opts.width ?? 512,
			height: opts.height ?? 768,
			steps: opts.steps ?? 30,
			cfg: opts.cfg ?? 7,
			sampler: "dpmpp_2m",
			tags: opts.tags ?? [],
			isPublic: opts.isPublic ?? false,
		};
		this.stylePresets.set(style.id, style);
		return style;
	}

	/**
	 * Create a ComfyUI workflow using the NSFW checkpoint.
	 * Requires age verification to use.
	 */
	createNSFWWorkflow(
		pkgId: string,
		workflowName: string,
		opts: {
			prompt: string;
			negativePrompt?: string;
			width?: number;
			height?: number;
			steps?: number;
			cfg?: number;
			seed?: number;
		},
	): ComfyUIWorkflow | null {
		if (!this.comfyui) return null;

		const pkg = this.packages.get(pkgId);
		const seed = opts.seed ?? Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
		const positiveText = opts.prompt;
		const negativeText = opts.negativePrompt ?? "worst quality, low quality, blurry";

		const workflow = JSON.parse(JSON.stringify(NSFW_WORKFLOW)) as Record<
			string,
			Record<string, unknown>
		>;

		(workflow["4"] as { inputs: { width: number; height: number } }).inputs.width =
			opts.width ?? 512;
		(workflow["4"] as { inputs: { width: number; height: number } }).inputs.height =
			opts.height ?? 768;
		(workflow["3"] as { inputs: { seed: number; steps: number; cfg: number } }).inputs.seed = seed;
		(workflow["3"] as { inputs: { seed: number; steps: number; cfg: number } }).inputs.steps =
			opts.steps ?? 30;
		(workflow["3"] as { inputs: { seed: number; steps: number; cfg: number } }).inputs.cfg =
			opts.cfg ?? 7;
		(workflow["5"] as { inputs: { text: string } }).inputs.text = positiveText;
		(workflow["7"] as { inputs: { text: string } }).inputs.text = negativeText;

		const comfyWorkflow: ComfyUIWorkflow = {
			id: `nsfw_${this.genId()}`,
			name: workflowName,
			workflowJson: workflow as unknown as Record<string, unknown>,
			lastPrompt: positiveText,
			lastNegativePrompt: negativeText,
			baseModel: "nsfwRealisticVisionV6",
			width: opts.width ?? 512,
			height: opts.height ?? 768,
			steps: opts.steps ?? 30,
			cfg: opts.cfg ?? 7,
			sampler: "dpmpp_2m",
			seed,
		};

		this.workflows.set(comfyWorkflow.id, comfyWorkflow);

		if (pkg) {
			if (!pkg.media.workflows) pkg.media.workflows = [];
			if (!pkg.media.workflows.some((w) => w.id === comfyWorkflow.id)) {
				pkg.media.workflows.push(comfyWorkflow);
			}
			this._publishLocal(pkg);
		}

		return comfyWorkflow;
	}

	/**
	 * Create a video generation workflow for short videos (GIF/MP4).
	 */
	createVideoWorkflow(
		pkgId: string,
		workflowName: string,
		opts: {
			prompt: string;
			negativePrompt?: string;
			width?: number;
			height?: number;
			steps?: number;
			cfg?: number;
			duration?: number;
			fps?: number;
			seed?: number;
		},
	): ComfyUIWorkflow | null {
		if (!this.comfyui) return null;

		const pkg = this.packages.get(pkgId);
		const seed = opts.seed ?? Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
		const positiveText = opts.prompt;
		const negativeText = opts.negativePrompt ?? "worst quality, low quality, blurry";

		const workflow = JSON.parse(JSON.stringify(VIDEO_WORKFLOW)) as Record<
			string,
			Record<string, unknown>
		>;

		(workflow["4"] as { inputs: { width: number; height: number } }).inputs.width =
			opts.width ?? 480;
		(workflow["4"] as { inputs: { width: number; height: number } }).inputs.height =
			opts.height ?? 640;
		(workflow["3"] as { inputs: { seed: number; steps: number; cfg: number } }).inputs.seed = seed;
		(workflow["3"] as { inputs: { seed: number; steps: number; cfg: number } }).inputs.steps =
			opts.steps ?? 20;
		(workflow["3"] as { inputs: { seed: number; steps: number; cfg: number } }).inputs.cfg =
			opts.cfg ?? 7;
		(workflow["5"] as { inputs: { text: string } }).inputs.text = positiveText;
		(workflow["6"] as { inputs: { text: string } }).inputs.text = negativeText;
		(workflow["12"] as { inputs: { frame_rate: number; duration: number } }).inputs.frame_rate =
			opts.fps ?? 8;
		(workflow["12"] as { inputs: { frame_rate: number; duration: number } }).inputs.duration =
			opts.duration ?? 5;

		const comfyWorkflow: ComfyUIWorkflow = {
			id: `vid_${this.genId()}`,
			name: workflowName,
			workflowJson: workflow as unknown as Record<string, unknown>,
			lastPrompt: positiveText,
			lastNegativePrompt: negativeText,
			baseModel: "realisticVisionV6",
			width: opts.width ?? 480,
			height: opts.height ?? 640,
			steps: opts.steps ?? 20,
			cfg: opts.cfg ?? 7,
			sampler: "euler",
			seed,
		};

		this.workflows.set(comfyWorkflow.id, comfyWorkflow);

		if (pkg) {
			if (!pkg.media.workflows) pkg.media.workflows = [];
			if (!pkg.media.workflows.some((w) => w.id === comfyWorkflow.id)) {
				pkg.media.workflows.push(comfyWorkflow);
			}
			this._publishLocal(pkg);
		}

		return comfyWorkflow;
	}

	/**
	 * Create a ComfyUI workflow from a text prompt and optional style preset.
	 */
	createWorkflow(
		pkgId: string,
		workflowName: string,
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
			stylePresetId?: string;
		},
	): ComfyUIWorkflow | null {
		if (!this.comfyui) return null;

		const pkg = this.packages.get(pkgId);
		const style = opts.stylePresetId ? this.stylePresets.get(opts.stylePresetId) : undefined;

		const merged = {
			prompt: opts.prompt,
			negativePrompt: opts.negativePrompt ?? style?.negativePrompt,
			model: opts.model ?? style?.model,
			width: opts.width ?? style?.width,
			height: opts.height ?? style?.height,
			steps: opts.steps ?? style?.steps,
			cfg: opts.cfg ?? style?.cfg,
			sampler: opts.sampler ?? style?.sampler,
			seed: opts.seed,
		};

		const workflow = this.comfyui.createWorkflowFromPrompt(
			`wf_${this.genId()}`,
			workflowName,
			merged,
		);

		this.workflows.set(workflow.id, workflow);

		if (pkg) {
			if (!pkg.media.workflows) pkg.media.workflows = [];
			if (!pkg.media.workflows.some((w) => w.id === workflow.id)) {
				pkg.media.workflows.push(workflow);
			}
			this._publishLocal(pkg);
		}

		return workflow;
	}

	/**
	 * Get all workflows attached to a package.
	 */
	getWorkflows(pkgId: string): ComfyUIWorkflow[] {
		const pkg = this.packages.get(pkgId);
		return pkg?.media.workflows ?? [];
	}

	/**
	 * Submit an image generation job to ComfyUI.
	 */
	async generateImage(
		pkgId: string,
		workflow: ComfyUIWorkflow,
	): Promise<{ jobId: string; status: string } | { error: string }> {
		if (!this.comfyui) {
			return { error: "ComfyUI client not configured" };
		}

		const status = await this.comfyui.getStatus();
		if (!status.online) {
			return { error: "ComfyUI is not online" };
		}

		const pkg = this.packages.get(pkgId);
		const job = await this.comfyui.submitWorkflow(workflow);

		if (job.status === "failed") {
			return { error: job.error ?? "Workflow submission failed" };
		}

		if (pkg) {
			if (!pkg.config.comfyuiUrl) pkg.config.comfyuiUrl = status.url;
			this._publishLocal(pkg);
		}

		return { jobId: job.id, status: job.status };
	}

	/**
	 * Wait for an image generation job to complete.
	 */
	async waitForImage(jobId: string, timeoutMs = 60000): Promise<ImageAsset | null> {
		if (!this.comfyui) return null;
		const job = await this.comfyui.waitForJob(jobId, timeoutMs);
		if (job.status === "completed" && job.image) {
			this.imageAssets.set(job.image.id, job.image);
			return job.image;
		}
		return null;
	}

	/**
	 * Get all generated images for a package.
	 */
	getPackageImages(pkgId: string): ImageAsset[] {
		const pkg = this.packages.get(pkgId);
		if (!pkg) return [];
		const pkgImages = pkg.media.images ?? [];
		return [...pkgImages];
	}

	/**
	 * Add an image asset to a package.
	 */
	addImageAsset(pkgId: string, image: ImageAsset): AIPackage | null {
		const pkg = this.packages.get(pkgId);
		if (!pkg) return null;
		if (!pkg.media.images) pkg.media.images = [];
		if (!pkg.media.images.some((img) => img.id === image.id)) {
			pkg.media.images.push(image);
		}
		this.imageAssets.set(image.id, image);
		this._publishLocal(pkg);
		return pkg;
	}

	/**
	 * Get all image assets.
	 */
	getAllImages(): ImageAsset[] {
		const pkgImages: ImageAsset[] = [];
		for (const pkg of this.packages.values()) {
			if (pkg.media.images) pkgImages.push(...pkg.media.images);
		}
		return [...pkgImages, ...Array.from(this.imageAssets.values())];
	}

	/**
	 * Get all generated videos for a package.
	 */
	getPackageVideos(pkgId: string): VideoAsset[] {
		const pkg = this.packages.get(pkgId);
		if (!pkg) return [];
		return pkg.media.videos ?? [];
	}

	/**
	 * Get all video assets across all packages.
	 */
	getAllVideos(): VideoAsset[] {
		const pkgVideos: VideoAsset[] = [];
		for (const pkg of this.packages.values()) {
			if (pkg.media.videos) pkgVideos.push(...pkg.media.videos);
		}
		return pkgVideos;
	}

	/**
	 * Add a video asset to a package.
	 */
	addVideoAsset(pkgId: string, video: VideoAsset): AIPackage | null {
		const pkg = this.packages.get(pkgId);
		if (!pkg) return null;
		if (!pkg.media.videos) pkg.media.videos = [];
		if (!pkg.media.videos.some((v) => v.id === video.id)) {
			pkg.media.videos.push(video);
		}
		this._publishLocal(pkg);
		return pkg;
	}

	/**
	 * Get all gallery items for a package (merged from gallery + images + galleryItems).
	 */
	getGalleryItems(pkgId: string): GalleryItem[] {
		const pkg = this.packages.get(pkgId);
		if (!pkg) return [];

		const items: GalleryItem[] = [];
		const galleryUrls = pkg.media.gallery ?? [];
		const images = pkg.media.images ?? [];
		const videos = pkg.media.videos ?? [];

		galleryUrls.forEach((url, idx) => {
			items.push({
				id: `${pkg.id}-gallery-${idx}`,
				type: "image",
				url,
				title: `${pkg.metadata.name} Gallery ${idx + 1}`,
				description: pkg.metadata.description,
				isUnlocked: true,
			});
		});

		for (const img of images) {
			items.push({
				id: img.id,
				type: "image",
				url: img.url,
				thumbnailUrl: img.thumbnailUrl,
				title: img.title,
				description: img.description,
				isUnlocked: true,
				prompt: img.prompt,
				isNSFW: img.isNSFW,
				metadata: {
					model: img.model,
					width: img.width,
					height: img.height,
					seed: img.seed,
					steps: img.steps,
					cfg: img.cfg,
					sampler: img.sampler,
				},
			});
		}

		for (const vid of videos) {
			items.push({
				id: vid.id,
				type: "video",
				url: vid.url,
				thumbnailUrl: vid.thumbnailUrl,
				title: vid.title,
				description: vid.description,
				isUnlocked: true,
				prompt: vid.prompt,
				duration: vid.duration,
				isNSFW: vid.isNSFW,
				metadata: {
					model: vid.model,
					width: vid.width,
					height: vid.height,
					fps: vid.fps,
					seed: undefined,
				},
			});
		}

		if (pkg.galleryItems) {
			items.push(...pkg.galleryItems);
		}

		return items;
	}

	/**
	 * Get trend scores per package for UI ordering.
	 */
	getTrendingScores(): Map<string, number> {
		return new Map(this.trendingScores);
	}
}

export { AI_PACKAGE_ACTION, DEFAULT_CONFIG, DEFAULT_MEDIA, DEFAULT_MCP_TOOLS };
export type {
	AIPackage,
	AIPackageConfig,
	AIPackageExport,
	AIPackageMedia,
	AIPackageMetadata,
	ComfyUIWorkflow,
	ForkRecord,
	GalleryItem,
	ImageAsset,
	MCPToolRef,
	ShareResult,
	StylePreset,
	TrendingAIPackage,
	AIHubStats,
	VideoAsset,
};
