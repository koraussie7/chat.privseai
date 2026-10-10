/**
 * Local Inference Provider (WebLLM / llama.cpp WASM)
 * 
 * 브라우저에서 직접 실행되는 로컬 LLM 추론 프로바이더입니다.
 * WebLLM(WebGPU) 또는 llama.cpp(WASM) 백엔드를 지원합니다.
 */

import type {
  InferenceProvider,
  InferenceRequest,
  InferenceChunk,
  HealthStatus,
  ModelReference,
  UnifiedCompanion,
} from '@/types/unified';

export type LocalBackend = 'webllm' | 'llamacpp';

export interface LocalProviderConfig {
  backend: LocalBackend;
  webllm?: {
    modelId: string;           // 예: 'Llama-3.2-3B-Instruct-q4f32_1-MLC'
    modelLib?: string;         // @mlc-ai/web-llm 자동 선택
  };
  llamacpp?: {
    modelPath: string;         // GGUF 파일 경로 (로컬 파일 또는 URL)
    nCtx?: number;             // 컨텍스트 길이
    nGpuLayers?: number;       // GPU 레이어 수 (WebGPU 사용 시)
  };
}

export class LocalInferenceProvider implements InferenceProvider {
  id = 'local-inference';
  name = 'Local Inference (WebLLM/llama.cpp)';
  type = 'local' as const;
  description = '브라우저 내장 WASM/WebGPU로 실행되는 완전 로컬 추론';
  supportsStreaming = true;
  supportsTools = false;  // WebLLM은 tool calling 미지원 (현재)
  supportsVision = false;
  maxContextLength = 4096;

  private config: LocalProviderConfig;
  private engine: any = null;  // WebLLM engine 또는 llama.cpp instance
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  constructor(config: LocalProviderConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      if (this.config.backend === 'webllm') {
        await this.initWebLLM();
      } else {
        await this.initLlamaCpp();
      }
      this.isInitialized = true;
    })();

    return this.initPromise;
  }

  private async initWebLLM(): Promise<void> {
    const { createWebLLMEngine } = await import('@mlc-ai/web-llm');

    const modelId = this.config.webllm?.modelId || 'Qwen2.5-0.5B-Instruct-q4f32_1-MLC';

    this.engine = await createWebLLMEngine({
      initProgressCallback: (progress: any) => {
        console.log('[WebLLM] Init:', progress.text, Math.round(progress.progress * 100) + '%');
      },
    });

    await this.engine.reload(modelId);
  }

  private async initLlamaCpp(): Promise<void> {
    // llama.cpp WASM 바인딩 (예: @llama-cpp/wasm 또는 커스텀 빌드)
    // 실제 구현 시 동적 import로 로드
    throw new Error('llama.cpp WASM 백엔드는 미구현입니다. WebLLM을 사용하세요.');
  }

  estimateCost(_request: InferenceRequest): number {
    // 로컬 추론은 무료 (사용자 기기 리소스)
    return 0;
  }

  async *infer(request: InferenceRequest): AsyncGenerator<InferenceChunk> {
    await this.initialize();

    const companion = request.companion;
    const systemPrompt = this.buildSystemPrompt(companion);
    
    const messages = [
      { role: 'system', content: systemPrompt },
      ...request.messages.map(m => ({ role: m.role, content: m.content }))
    ];

    try {
      if (this.config.backend === 'webllm') {
        yield* this.inferWebLLM(messages, request);
      } else {
        yield* this.inferLlamaCpp(messages, request);
      }
    } catch (error) {
      yield { 
        type: 'error', 
        error: error instanceof Error ? error.message : 'Local inference failed' 
      };
    }
  }

  private async *inferWebLLM(
    messages: Array<{ role: string; content: string }>,
    request: InferenceRequest
  ): AsyncGenerator<InferenceChunk> {
    const completion = await this.engine.chat.completions.create({
      messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 512,
      top_p: request.topP ?? 0.9,
      stream: true,
    });

    for await (const chunk of completion) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield { type: 'content', content };
      }
    }
    
    yield { type: 'done' };
  }

  private async *inferLlamaCpp(
    _messages: Array<{ role: string; content: string }>,
    _request: InferenceRequest
  ): AsyncGenerator<InferenceChunk> {
    // llama.cpp 스트리밍 구현
    throw new Error('Not implemented');
  }

  private buildSystemPrompt(companion: UnifiedCompanion): string {
    const personality = companion.personality.join(', ');
    return `${companion.systemPrompt}\n\nPersonality: ${personality}\n\nYou are ${companion.name}. Stay in character.`;
  }

  async checkHealth(): Promise<HealthStatus> {
    if (!this.isInitialized) {
      return { healthy: false, message: 'Not initialized' };
    }

    try {
      // 간단한 테스트 추론
      const start = Date.now();
      await this.engine?.chat.completions.create({
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
        stream: false,
      });
      return { 
        healthy: true, 
        latencyMs: Date.now() - start,
        message: 'Local engine ready'
      };
    } catch (error) {
      return { 
        healthy: false, 
        message: error instanceof Error ? error.message : 'Health check failed' 
      };
    }
  }

  async getAvailableModels(): Promise<ModelReference[]> {
    // WebLLM에서 사용 가능한 모델 목록
    if (this.config.backend === 'webllm') {
      // This build of @mlc-ai/web-llm does not ship a runtime model catalog.
      // Surface the configured model so the selector still has a valid entry.
      const modelId = this.config.webllm?.modelId || 'Qwen2.5-0.5B-Instruct-q4f32_1-MLC';
      return [{
        type: 'local' as const,
        localModelId: modelId,
        modelName: modelId,
        quantization: undefined,
        contextLength: 4096,
      }];
    }
    return [];
  }

  async dispose(): Promise<void> {
    if (this.engine) {
      await this.engine.unload();
      this.engine = null;
      this.isInitialized = false;
    }
  }
}

// 팩토리 함수
export function createLocalProvider(backend: LocalBackend = 'webllm'): LocalInferenceProvider {
  return new LocalInferenceProvider({ backend });
}