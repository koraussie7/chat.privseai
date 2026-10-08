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
import { ModelDistributor } from "@/lib/model-distributor";
import type { TrysteroP2PClient } from "@/lib/trystero-client";
import type {
  AIHubStats,
  AIPackage,
  AIPackageConfig,
  AIPackageExport,
  AIPackageMedia,
  AIPackageMetadata,
  ForkRecord,
  MCPToolRef,
  ShareResult,
  TrendingAIPackage,
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
];

export class AIHub {
  private packages = new Map<string, AIPackage>();
  private forks = new Map<string, ForkRecord>();
  private client: TrysteroP2PClient | null = null;
  private unsubscribePackage: (() => void) | null = null;
  private distributor = new ModelDistributor();
  private trendingScores = new Map<string, number>();
  private packagePeers = new Map<string, Set<string>>();

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
              onMessage:
                ((data: unknown, ctx: { peerId: string }) => void) | null;
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
      systemPrompt:
        opts.config?.systemPrompt ?? opts.card.data.system_prompt ?? "",
      ...opts.config,
    };

    const media: AIPackageMedia = {
      ...DEFAULT_MEDIA,
      avatarUrl: opts.media?.avatarUrl ?? opts.card.data.src ?? "",
      gallery: opts.media?.gallery ?? [],
      vrmModel:
        opts.media?.vrmModel ??
        (opts.card.data.extensions?.vrm as string | undefined),
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
    forked.metadata.description =
      overrides.description ?? source.metadata.description;
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
  async requestPackage(
    peerId: string,
    packageId: string,
  ): Promise<AIPackage | null> {
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
      const response = queryAction.request(
        { packageId },
        { target: peerId, timeoutMs: 15000 },
      );

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

      this.trendingScores.set(
        pkg.id,
        (this.trendingScores.get(pkg.id) ?? 0) + 1,
      );

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
}

export { AI_PACKAGE_ACTION, DEFAULT_CONFIG, DEFAULT_MEDIA, DEFAULT_MCP_TOOLS };
export type {
  AIPackage,
  AIPackageConfig,
  AIPackageExport,
  AIPackageMedia,
  AIPackageMetadata,
  ForkRecord,
  MCPToolRef,
  ShareResult,
  TrendingAIPackage,
  AIHubStats,
};
