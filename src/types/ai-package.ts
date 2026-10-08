/**
 * AI Package format for privseai.com "AI Hub" feature.
 *
 * An AIPackage bundles everything needed to import and run an AI companion
 * on the P2P network: personality card data, base model reference, tools,
 * memory references, and media. Packages can be shared via Trystero P2P,
 * with the AI Creator being able to publish, and consumers cloning or
 * remixing them.
 *
 * The format is compatible with SillyTavern chara_card_v2/v3: the `card`
 * field carries the standard character card data, and `extensions`
 * carries YuriOS/MuhanAI-specific fields (vrm_model, mcp_tools, etc.).
 */

import type { CharacterCard } from "./character";

export interface MCPToolRef {
  id: string;
  name: string;
  url: string;
  icon?: string;
  description?: string;
}

export interface ComfyUIWorkflow {
  id: string;
  name: string;
  workflowJson: Record<string, unknown>;
  lastPrompt?: string;
  lastNegativePrompt?: string;
  baseModel?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfg?: number;
  sampler?: string;
  seed?: number;
}

export interface ImageAsset {
  id: string;
  url: string;
  thumbnailUrl?: string;
  title: string;
  description: string;
  prompt: string;
  negativePrompt?: string;
  model: string;
  width?: number;
  height?: number;
  seed?: number;
  steps?: number;
  cfg?: number;
  sampler?: string;
  generatedAt?: number;
  workflowId?: string;
  tags?: string[];
  isFavorite?: boolean;
  metadata?: Record<string, unknown>;
}

export interface StylePreset {
  id: string;
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
}

export interface AIPackageMedia {
  avatarUrl?: string;
  bannerUrl?: string;
  voiceId?: string;
  vrmModel?: string;
  gallery?: string[];
  creatorAvatar?: string;
  images?: ImageAsset[];
  styles?: StylePreset[];
  workflows?: ComfyUIWorkflow[];
}

export interface AIPackageMetadata {
  name: string;
  description: string;
  version: string;
  creator: string;
  creatorAvatar?: string;
  baseModel: string;
  quantization: string;
  parameters: string;
  createdAt: number;
  publishedAt?: number;
  updatedAt: number;
  tags: string[];
  category: "realistic" | "anime" | "cyber" | "fantasy" | "other";
  isPublic: boolean;
  isLive: boolean;
  downloadCount: number;
  likeCount: number;
  forks: number;
  language: string;
  imageModel?: string;
}

export interface AIPackageConfig {
  systemPrompt: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  mindToolsEnabled: boolean;
  mindDailyTokens: number;
  mindToolCallsPerDay: number;
  vaultPath?: string;
  telegramRelay?: boolean;
  comfyuiUrl?: string;
}

export interface AIPackage {
  id: string;
  spec: "ai-package-v1";
  metadata: AIPackageMetadata;
  card: CharacterCard;
  config: AIPackageConfig;
  tools: MCPToolRef[];
  media: AIPackageMedia;
  forkedFrom?: {
    id: string;
    name: string;
    forkId: string;
    forkedAt: number;
  };
  downloadCid?: string;
  modelCid?: string;
  signature?: string;
  galleryItems?: GalleryItem[];
}

export interface ForkRecord {
  id: string;
  fromPackageId: string;
  fromForkId: string;
  package: AIPackage;
  forkedAt: number;
  forkedBy: string;
}

export interface ShareResult {
  success: boolean;
  peerId?: string;
  error?: string;
  bytesSent?: number;
}

export interface TrendingAIPackage extends AIPackage {
  trendingScore: number;
  lastActivePeer?: string;
  peersWithModel: number;
}

export interface AIHubStats {
  totalPackages: number;
  totalPeers: number;
  cachedModels: number;
  totalDownloads: number;
}

export interface AIPackageExport {
  package: AIPackage;
  exportedAt: number;
  exportedBy: string;
}

export interface GalleryItem {
  id: string;
  type: "image" | "video";
  url: string;
  thumbnailUrl?: string;
  title: string;
  description: string;
  isUnlocked: boolean;
  requiredStage?: number;
  prompt?: string;
  metadata?: Record<string, unknown>;
}
