/**
 * TypeScript type contracts derived from the muhanai Pythia schemas.
 * Mirrors `deploy/pythia_connector/models.py` in the agentmesh repo.
 */

export type EventSeverity = "info" | "warning" | "critical" | "fatal";
export type ForecastConfidence = "low" | "medium" | "high" | "certain";
export type ImpactTier = "low" | "medium" | "high" | "critical";

export interface PythiaEvent {
  event_id: string;
  source_agent: string;
  source_run?: string | null;
  timestamp: string;
  kind: string;
  severity: EventSeverity;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  cid?: string | null;
  schema_version: string;
}

export interface PythiaForecast {
  forecast_id: string;
  agent_id: string;
  created_at: string;
  resolved_at?: string | null;
  hypothesis: string;
  outcome: string;
  confidence: ForecastConfidence;
  confidence_numeric?: number | null;
  horizon?: string | null;
  window_start?: string | null;
  window_end?: string | null;
  supporting_events: string[];
  citations: string[];
  localcrab_claim_id?: string | null;
}

export interface ImpactAnalysis {
  target_id: string;
  target_type: "event" | "forecast";
  tier: ImpactTier;
  score: number;
  affected_agents: string[];
  affected_domains: string[];
  rationale: string;
  mitigations: string[];
  generated_by: string;
  generated_at: string;
  colibri_metrics_ref?: string | null;
}

export interface ColibriMetrics {
  modelName: string;
  modelCid: string;
  vocabSize: number;
  hiddenSize: number;
  numLayers: number;
  numHeads: number;
  headDim: number;
  maxSeqLen: number;
  tokensGenerated: number;
  tokensPerSecond: number;
  memoryUsedMB: number;
  memoryTotalMB: number;
  loadTimeMs: number;
  timestamp: number;
}

export interface PeerMetrics {
  peerId: string;
  connectedAt: number;
  bytesSent: number;
  bytesReceived: number;
  latencyMs: number;
  rttHistory: number[];
}

export interface ModelChunkMetrics {
  cid: string;
  modelName: string;
  totalChunks: number;
  servedChunks: number;
  cachedBytes: number;
  bandwidthBps: number;
  lastRequestedAt: number;
}

export interface PythiaMetricsPacket {
  events: PythiaEvent[];
  forecasts: PythiaForecast[];
  impacts: ImpactAnalysis[];
  colibri: ColibriMetrics;
  peers: PeerMetrics[];
  chunk: ModelChunkMetrics;
  schema_version: string;
}

export const IMPACT_TIER_LEVELS: Record<ImpactTier, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export const SEVERITY_COLORS: Record<EventSeverity, string> = {
  info: "text-blue-500",
  warning: "text-amber-500",
  critical: "text-red-500",
  fatal: "text-red-700",
};

export const IMPACT_TIER_COLORS: Record<ImpactTier, string> = {
  low: "text-green-500",
  medium: "text-amber-500",
  high: "text-orange-500",
  critical: "text-red-600",
};
