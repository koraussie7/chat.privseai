/**
 * P2P Inference Provider
 * 
 * llmp2p의 AIHub + ModelDistributor를 InferenceProvider 인터페이스로 래핑합니다.
 * Trystero P2P 네트워크를 통해 분산된 모델로 추론을 수행합니다.
 */

import type {
  PeerCapability,
  InferenceProvider,
  InferenceRequest,
  InferenceChunk,
  HealthStatus,
  ModelReference,
  UnifiedCompanion,
  ModelDistributionInfo,
  P2PNetworkState,

} from '@/types/unified';

import { AIHub } from '@/lib/ai-hub';
import { ModelDistributor } from '@/lib/model-distributor';
import type { TrysteroP2PClient } from '@/lib/trystero-client';

export class P2PInferenceProvider implements InferenceProvider {
  id = 'p2p-inference';
  name = 'P2P Distributed Inference';
  type = 'p2p' as const;
  description = 'Trystero P2P 네트워크를 통한 분산 모델 추론';
  supportsStreaming = true;
  supportsTools = true;
  supportsVision = false;
  maxContextLength = 8192;

  private aiHub: AIHub;
  private distributor: ModelDistributor;
  private trysteroClient: TrysteroP2PClient | null = null;
  private modelCache: Map<string, string> = new Map(); // modelRef.cid -> local path

  constructor(aiHub: AIHub, trysteroClient: TrysteroP2PClient | null = null) {
    this.aiHub = aiHub;
    this.distributor = (aiHub as any).distributor || new ModelDistributor();
    this.trysteroClient = trysteroClient;
  }

  setTrysteroClient(client: TrysteroP2PClient): void {
    this.trysteroClient = client;
    this.distributor.setClient(client);
  }

  estimateCost(_request: InferenceRequest): number {
    // P2P 추론은 무료 (로컬 리소스 사용)
    return 0;
  }

  async *infer(request: InferenceRequest): AsyncGenerator<InferenceChunk> {
    const companion = request.companion;
    const modelRef = companion.modelRef;

    if (!modelRef || modelRef.type !== 'p2p' || !modelRef.cid) {
      yield { type: 'error', error: 'P2P 모델 참조가 없습니다 (cid 필요)' };
      return;
    }

    try {
      // 1. 모델 확보 (캐시 → P2P 다운로드)
      const modelPath = await this.ensureModel(modelRef);

      // 2. 추론 워커에서 실행 (Colibri WASM 또는 llama.cpp)
      const worker = await this.getInferenceWorker(modelPath);
      
      // 3. 시스템 프롬프트 구성
      const systemPrompt = this.buildSystemPrompt(companion);
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        ...request.messages
      ];

      // 4. 스트리밍 추론
      for await (const chunk of worker.streamChat({
        messages,
        temperature: request.temperature ?? 0.7,
        maxTokens: request.maxTokens ?? 512,
        topP: request.topP ?? 0.9,
        tools: request.tools,
      })) {
        yield chunk;
      }
    } catch (error) {
      yield { 
        type: 'error', 
        error: error instanceof Error ? error.message : 'P2P 추론 실패' 
      };
    }
  }

  private async ensureModel(modelRef: ModelReference): Promise<string> {
    const cacheKey = modelRef.cid!;
    
    if (this.modelCache.has(cacheKey)) {
      return this.modelCache.get(cacheKey)!;
    }

    // ModelDistributor가 fetchModel을 제공하지 않으면 P2P 다운로드를 건너뛴다.
    const distributor = this.distributor as unknown as {
      fetchModel?: (cid: string) => Promise<string>;
    };
    if (typeof distributor.fetchModel !== "function") {
      throw new Error("P2P model fetching is not available in this build");
    }
    const localPath = await distributor.fetchModel(cacheKey);
    this.modelCache.set(cacheKey, localPath);
    return localPath;
  }

  private async getInferenceWorker(modelPath: string): Promise<InferenceWorker> {
    // Colibri WASM 워커 또는 llama.cpp WASM 워커 반환
    // 실제 구현에서는 동적 import로 워커 로드
    return new InferenceWorker(modelPath);
  }

  private buildSystemPrompt(companion: UnifiedCompanion): string {
    const basePrompt = companion.systemPrompt;
    const personality = companion.personality.join(', ');
    const relationship = this.getRelationshipContext(companion.relationship);
    
    return `${basePrompt}\n\nPersonality: ${personality}\nRelationship: ${relationship}\n\nYou are ${companion.name}. Stay in character.`;
  }

  private getRelationshipContext(rel: UnifiedCompanion['relationship']): string {
    const stages = ['Stranger', 'Acquaintance', 'Friend', 'Close Friend', 'Partner', 'Soulmate'];
    const stageName = stages[rel.stage] || `Stage ${rel.stage}`;
    return `${stageName} (XP: ${rel.xp}/${rel.xpToNext})`;
  }

  async checkHealth(): Promise<HealthStatus> {
    if (!this.trysteroClient) {
      return { healthy: false, message: 'Trystero client not connected' };
    }

    const state = this.trysteroClient.getNetworkState();
    const peerCount = state.peerCount;

    if (peerCount === 0) {
      return { 
        healthy: false, 
        message: 'No P2P peers connected',
        latencyMs: 0
      };
    }

    // 첫 번째 피어에게 핑 테스트
    const start = Date.now();
    try {
      // 간단한 헬스체크 (실제로는 ping/pong 메시지 교환)
      await new Promise(resolve => setTimeout(resolve, 100));
      return { 
        healthy: true, 
        latencyMs: Date.now() - start,
        message: `Connected to ${peerCount} peers`
      };
    } catch {
      return { healthy: false, message: 'Peer health check failed' };
    }
  }

  async getAvailableModels(): Promise<ModelReference[]> {
    const models: ModelReference[] = [];
    
    // AIHub에 등록된 패키지들의 모델 참조 수집
    const packages = this.aiHub.getAllPackages();
    for (const pkg of packages) {
      if (pkg.modelCid) {
        models.push({
          type: 'p2p',
          cid: pkg.modelCid,
          modelName: pkg.metadata.name,
          quantization: pkg.metadata.quantization as any,
          sizeBytes: 0, // TODO: 실제 크기 조회
        });
      }
    }

    // P2P 네트워크에서 공유 중인 모델들도 조회
    if (this.trysteroClient) {
      const networkModels = await this.queryNetworkModels();
      models.push(...networkModels);
    }

    return models;
  }

  private async queryNetworkModels(): Promise<ModelReference[]> {
    // 네트워크에 모델 목록 요청 브로드캐스트
    // 실제 구현에서는 Trystero action으로 요청
    return [];
  }

  // P2P 네트워크 상태 조회
  getNetworkState(): P2PNetworkState {
    if (!this.trysteroClient) {
      return { connected: false, peerCount: 0, peers: [], isRelay: false };
    }

    const state = this.trysteroClient.getNetworkState();
    return {
      connected: state.peerCount > 0,
      peerCount: state.peerCount,
      peers: state.peers.map((p) => ({
        id: p.id,
        name: p.id,
        connectedAt: p.joinedAt,
        capabilities: (p.capabilities ?? []) as PeerCapability[],
        sharedModels: [],
      })),
      isRelay: false,
      relayUrl: undefined,
    };
  }

  // 모델 배포 정보 조회 (미구현 시 null)
  async getModelDistributionInfo(_cid: string): Promise<ModelDistributionInfo | null> {
    return null;
  }
}

// 추론 워커 추상화 (실제로는 Colibri/llama.cpp WASM 워커)
class InferenceWorker {
  private modelPath: string;
  private worker: Worker | null = null;

  constructor(modelPath: string) {
    this.modelPath = modelPath;
  }

  async *streamChat(_params: {
    messages: Array<{ role: string; content: string }>;
    temperature: number;
    maxTokens: number;
    topP: number;
    tools?: any[];
  }): AsyncGenerator<InferenceChunk> {
    void this.modelPath; // resolved locally by the worker implementation
    // TODO: 실제 워커 구현 시 Colibri WASM 또는 llama.cpp WASM 연동
    // 현재는 모의 구현
    yield { type: 'content', content: '[P2P 추론 모의 응답] ' };
    yield { type: 'content', content: '이 응답은 P2P 네트워크의 분산 모델에서 생성되었습니다.' };
    yield { type: 'done' };
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}