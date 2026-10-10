/**
 * Providers Index
 * 
 * 모든 추론 프로바이더를 통합 export합니다.
 */

export { P2PInferenceProvider } from './P2PInferenceProvider';
export { LocalInferenceProvider, createLocalProvider, type LocalProviderConfig } from './LocalInferenceProvider';
export { 
  CloudInferenceProvider, 
  createOpenAIProvider, 
  createAnthropicProvider,
  createGroqProvider,
  createTogetherProvider,
  type CloudProviderConfig 
} from './CloudInferenceProvider';

import type { InferenceProvider } from '@/types/unified';
import { P2PInferenceProvider } from './P2PInferenceProvider';
import { LocalInferenceProvider } from './LocalInferenceProvider';
import { CloudInferenceProvider } from './CloudInferenceProvider';
import { AIHub } from '@/lib/ai-hub';
import type { TrysteroP2PClient } from '@/lib/trystero-client';

export type ProviderType = 'p2p' | 'local' | 'cloud';

export interface ProviderRegistry {
  p2p: P2PInferenceProvider | null;
  local: LocalInferenceProvider | null;
  cloud: CloudInferenceProvider | null;
}

export class ProviderManager {
  private registry: ProviderRegistry = {
    p2p: null,
    local: null,
    cloud: null,
  };
  
  private activeProvider: ProviderType = 'p2p';
  private fallbackOrder: ProviderType[] = ['p2p', 'local', 'cloud'];

  constructor(
    aiHub: AIHub,
    trysteroClient: TrysteroP2PClient | null = null
  ) {
    this.registry.p2p = new P2PInferenceProvider(aiHub, trysteroClient);
  }

  // 로컬 프로바이더 초기화
  async initLocal(backend: 'webllm' | 'llamacpp' = 'webllm'): Promise<void> {
    this.registry.local = new LocalInferenceProvider({ backend });
    await this.registry.local.initialize();
  }

  // 클라우드 프로바이더 설정
  setCloud(provider: CloudInferenceProvider): void {
    this.registry.cloud = provider;
  }

  // 빠른 클라우드 설정 (API 키만으로)
  setupCloudQuick(provider: 'openai' | 'anthropic' | 'groq' | 'together', apiKey: string, model?: string): void {
    let cloudProvider: CloudInferenceProvider;
    
    switch (provider) {
      case 'openai':
        cloudProvider = CloudInferenceProvider.prototype.constructor.name === 'CloudInferenceProvider' 
          ? new CloudInferenceProvider({ provider: 'openai', apiKey, defaultModel: model || 'gpt-4o-mini', models: ['gpt-4o', 'gpt-4o-mini'] })
          : null as any;
        break;
      case 'anthropic':
        cloudProvider = new CloudInferenceProvider({ provider: 'anthropic', apiKey, defaultModel: model || 'claude-3-5-haiku', models: ['claude-3-5-sonnet', 'claude-3-5-haiku'] });
        break;
      case 'groq':
        cloudProvider = new CloudInferenceProvider({ provider: 'groq', apiKey, defaultModel: model || 'llama-3.1-8b-instant', models: ['llama-3.1-70b-versatile', 'llama-3.1-8b-instant'] });
        break;
      case 'together':
        cloudProvider = new CloudInferenceProvider({ provider: 'together', apiKey, defaultModel: model || 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', models: ['meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo'] });
        break;
    }
    
    this.registry.cloud = cloudProvider!;
  }

  // 활성 프로바이더 변경
  setActiveProvider(type: ProviderType): void {
    if (this.registry[type]) {
      this.activeProvider = type;
    }
  }

  // 현재 활성 프로바이더 가져오기
  getActiveProvider(): InferenceProvider | null {
    return this.registry[this.activeProvider];
  }

  // 사용 가능한 모든 프로바이더 가져오기
  getAvailableProviders(): Array<{ type: ProviderType; provider: InferenceProvider; healthy: boolean }> {
    return this.fallbackOrder
      .map(type => {
        const provider = this.registry[type];
        return provider ? { type, provider, healthy: true } : null;
      })
      .filter(Boolean) as any;
  }

  // 자동 폴백 추론
  async *inferWithFallback(request: any): AsyncGenerator<any> {
    const errors: string[] = [];

    for (const type of this.fallbackOrder) {
      const provider = this.registry[type];
      if (!provider) continue;

      try {
        const health = await provider.checkHealth();
        if (!health.healthy) {
          errors.push(`${type}: ${health.message}`);
          continue;
        }

        // 프로바이더가 해당 모델을 지원하는지 확인
        await provider.getAvailableModels();
        const modelRef = request.companion.modelRef;
        
        if (modelRef && modelRef.type !== type && type !== 'cloud') {
          // 타입이 맞지 않으면 스킵 (클라우드는 모든 모델 지원)
          continue;
        }

        yield* provider.infer(request);
        return; // 성공 시 종료
      } catch (error) {
        errors.push(`${type}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        continue;
      }
    }

    // 모든 프로바이더 실패
    yield { 
      type: 'error', 
      error: `모든 프로바이더 실패: ${errors.join('; ')}` 
    };
  }

  // 헬스체크 모두 실행
  async checkAllHealth(): Promise<Record<ProviderType, any>> {
    const results: any = {};
    for (const type of this.fallbackOrder) {
      const provider = this.registry[type];
      if (provider) {
        results[type] = await provider.checkHealth();
      } else {
        results[type] = { healthy: false, message: 'Not initialized' };
      }
    }
    return results;
  }

  // 정리
  async dispose(): Promise<void> {
    if (this.registry.local) {
      await this.registry.local.dispose();
    }
  }
}