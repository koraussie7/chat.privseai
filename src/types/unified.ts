/**
 * Shared types for llmp2p × OpenTamago integration
 * 
 * 이 패키지는 양쪽 시스템이 공유하는 핵심 타입들을 정의합니다.
 * npm 패키지로 분리하여 독립적으로 버전 관리 가능합니다.
 */

// ============================================================================
// Core Companion Types
// ============================================================================

export interface UnifiedCompanion {
  id: string;
  name: string;
  tagline?: string;
  avatarUrl: string;
  bannerUrl?: string;
  systemPrompt: string;
  personality: string[];
  hobbies?: string[];
  age?: number;
  gender?: 'female' | 'male' | 'non-binary' | 'other';
  category?: CompanionCategory;
  relationship: RelationshipProgress;
  memory: MemoryEntry[];
  modelRef: ModelReference;
  capabilities: CapabilityFlags;
  gallery: GalleryItem[];
  voiceId?: string;
  greeting?: string;
  createdAt: number;
  updatedAt: number;
  creator: string;
  isPublic: boolean;
  tags: string[];
}

export type CompanionCategory = 
  | 'realistic' 
  | 'anime' 
  | 'cyber' 
  | 'fantasy' 
  | 'historical' 
  | 'scifi' 
  | 'slice-of-life';

export interface RelationshipProgress {
  stage: number;
  xp: number;
  xpToNext: number;
  totalXp: number;
  unlockedContent: string[];
  milestones: Milestone[];
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  achievedAt: number;
  rewardType: 'gallery' | 'scenario' | 'voice' | 'outfit' | 'memory';
  rewardRef: string;
}

export interface MemoryEntry {
  id: string;
  type: 'fact' | 'preference' | 'event' | 'summary' | 'emotion';
  content: string;
  importance: number;
  tags: string[];
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  source: 'user' | 'assistant' | 'system' | 'inferred';
  relatedCompanionId?: string;
}

export interface GalleryItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
  title: string;
  description?: string;
  prompt?: string;
  isUnlocked: boolean;
  requiredStage?: number;
  isNSFW: boolean;
  metadata?: ImageMetadata;
  createdAt: number;
}

export interface ImageMetadata {
  model?: string;
  width?: number;
  height?: number;
  seed?: number;
  steps?: number;
  cfg?: number;
  sampler?: string;
  workflowId?: string;
  source?: 'generated' | 'uploaded' | 'stock' | 'unsplash' | 'wikimedia';
  negativePrompt?: string;
}

// ============================================================================
// Model & Inference Types
// ============================================================================

export type ModelSourceType = 'p2p' | 'local' | 'cloud';

export interface ModelReference {
  type: ModelSourceType;
  cid?: string;
  modelName?: string;
  quantization?: QuantizationType;
  sizeBytes?: number;
  localModelId?: string;
  cloudProvider?: CloudProvider;
  cloudModel?: string;
  contextLength?: number;
  capabilities?: ModelCapability[];
}

export type QuantizationType = 
  | 'Q2_K' | 'Q3_K_M' | 'Q3_K_L' 
  | 'Q4_K_M' | 'Q4_K_L' | 'Q4_0' | 'Q4_1'
  | 'Q5_K_M' | 'Q5_K_L' | 'Q5_0' | 'Q5_1'
  | 'Q6_K' | 'Q8_0' | 'F16' | 'F32';

export type CloudProvider = 'openai' | 'anthropic' | 'google' | 'groq' | 'together' | 'custom';

export type ModelCapability = 
  | 'chat' 
  | 'completion' 
  | 'tools' 
  | 'vision' 
  | 'audio' 
  | 'embedding' 
  | 'reasoning';

export interface CapabilityFlags {
  chat: boolean;
  imageGeneration: boolean;
  videoGeneration: boolean;
  voice: boolean;
  memory: boolean;
  tools: boolean;
  p2pSync: boolean;
  nsfw: boolean;
  multimodal: boolean;
}

export interface InferenceRequest {
  companion: UnifiedCompanion;
  messages: ChatMessage[];
  stream: boolean;
  tools?: MCPTool[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  stopSequences?: string[];
  metadata?: Record<string, unknown>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
  timestamp?: number;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface MCPTool {
  id: string;
  name: string;
  description: string;
  url: string;
  icon?: string;
  inputSchema: Record<string, unknown>;
}

export interface InferenceProvider {
  id: string;
  name: string;
  type: ModelSourceType;
  description: string;
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
  maxContextLength: number;
  estimateCost(request: InferenceRequest): number;
  infer(request: InferenceRequest): AsyncGenerator<InferenceChunk>;
  checkHealth(): Promise<HealthStatus>;
  getAvailableModels(): Promise<ModelReference[]>;
}

export interface InferenceChunk {
  type: 'content' | 'tool_call' | 'tool_result' | 'done' | 'error';
  content?: string;
  toolCall?: ToolCall;
  toolResult?: { toolCallId: string; content: string };
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface HealthStatus {
  healthy: boolean;
  latencyMs?: number;
  message?: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// P2P Network Types
// ============================================================================

export interface P2PNetworkState {
  connected: boolean;
  peerCount: number;
  peers: P2PPeerInfo[];
  isRelay: boolean;
  relayUrl?: string;
}

export interface P2PPeerInfo {
  id: string;
  name?: string;
  connectedAt: number;
  latencyMs?: number;
  capabilities: PeerCapability[];
  sharedModels: string[];
}

export type PeerCapability = 
  | 'inference' 
  | 'model-hosting' 
  | 'relay' 
  | 'signaling' 
  | 'storage';

export interface ModelDistributionInfo {
  cid: string;
  name: string;
  sizeBytes: number;
  quantization: QuantizationType;
  seeders: number;
  leechers: number;
  lastSeen: number;
  chunks: ChunkInfo[];
}

export interface ChunkInfo {
  index: number;
  hash: string;
  size: number;
  peers: string[];
}

// ============================================================================
// Sync Types
// ============================================================================

export interface SyncState {
  companionId: string;
  lastSyncedAt: number;
  pendingChanges: number;
  conflictCount: number;
  status: 'idle' | 'syncing' | 'conflict' | 'error';
  error?: string;
}

export interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entityType: 'companion' | 'memory' | 'relationship' | 'gallery';
  entityId: string;
  data: unknown;
  timestamp: number;
  vectorClock: Record<string, number>;
}

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// ============================================================================
// Type Guards
// ============================================================================

export function isP2PModel(ref: ModelReference): ref is ModelReference & { type: 'p2p'; cid: string } {
  return ref.type === 'p2p' && !!ref.cid;
}

export function isLocalModel(ref: ModelReference): ref is ModelReference & { type: 'local'; localModelId: string } {
  return ref.type === 'local' && !!ref.localModelId;
}

export function isCloudModel(ref: ModelReference): ref is ModelReference & { type: 'cloud'; cloudModel: string } {
  return ref.type === 'cloud' && !!ref.cloudModel;
}

export function getModelDisplayName(ref: ModelReference): string {
  if (isP2PModel(ref)) return ref.modelName || ref.cid?.slice(0, 12) + '...' || 'P2P Model';
  if (isLocalModel(ref)) return ref.localModelId;
  if (isCloudModel(ref)) return `${ref.cloudProvider}:${ref.cloudModel}`;
  return 'Unknown Model';
}