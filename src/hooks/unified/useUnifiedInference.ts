/**
 * useUnifiedInference Hook
 * 
 * 통합 추론 훅 - P2P, 로컬, 클라우드 프로바이더를 자동 선택 및 폴백합니다.
 * 캐릭터별 최적 프로바이더 선택, 스트리밍, 도구 호출을 지원합니다.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  InferenceProvider,
  InferenceRequest,
  InferenceChunk,
  HealthStatus,
  ModelReference,
  UnifiedCompanion,
  ProviderType,
} from '@/types/unified';
import { ProviderManager } from '@/lib/providers';
import { AIHub } from '@/lib/ai-hub';
import { useAIHub } from '@/hooks/useAIHub';
import { useTrystero } from '@/hooks/useTrysteroP2P';

export interface UseUnifiedInferenceOptions {
  /** 선호하는 프로바이더 순서 (자동 폴백 순서) */
  fallbackOrder?: ProviderType[];
  /** 자동 헬스체크 간격 (ms) */
  healthCheckInterval?: number;
  /** 로컬 WebLLM 백엔드 */
  localBackend?: 'webllm' | 'llamacpp';
  /** 클라우드 설정 (API 키 등) */
  cloudConfig?: {
    provider: 'openai' | 'anthropic' | 'groq' | 'together';
    apiKey: string;
    model?: string;
  };
  /** 프로바이더 변경 콜백 */
  onProviderChange?: (type: ProviderType) => void;
  /** 에러 콜백 */
  onError?: (error: Error, provider: ProviderType) => void;
}

export interface UseUnifiedInferenceReturn {
  /** 현재 활성 프로바이더 */
  activeProvider: ProviderType | null;
  /** 사용 가능한 프로바이더 목록 */
  availableProviders: Array<{ type: ProviderType; provider: InferenceProvider; healthy: boolean }>;
  /** 프로바이더 헬스 상태 */
  healthStatus: Record<ProviderType, HealthStatus>;
  /** 추론 중 여부 */
  isInferring: boolean;
  /** 현재 추청 중인 프로바이더 */
  inferringProvider: ProviderType | null;
  /** 스트리밍 추론 실행 */
  infer: (request: InferenceRequest) => AsyncGenerator<InferenceChunk>;
  /** 프로바이더 수동 변경 */
  setActiveProvider: (type: ProviderType) => void;
  /** 헬스체크 수동 실행 */
  checkHealth: () => Promise<void>;
  /** 로컬 프로바이더 초기화 */
  initLocal: (backend?: 'webllm' | 'llamacpp') => Promise<void>;
  /** 클라우드 프로바이더 설정 */
  setupCloud: (config: UseUnifiedInferenceOptions['cloudConfig']) => void;
  /** 모든 프로바이더 정리 */
  dispose: () => Promise<void>;
}

/**
 * 통합 추론 훅
 * 
 * @example
 * ```tsx
 * const { infer, activeProvider, isInferring } = useUnifiedInference({
 *   fallbackOrder: ['p2p', 'local', 'cloud'],
 *   cloudConfig: { provider: 'groq', apiKey: 'xxx', model: 'llama-3.1-8b-instant' }
 * });
 * 
 * // 사용
 * for await (const chunk of infer({
 *   companion,
 *   messages: [{ role: 'user', content: 'Hello!' }],
 *   stream: true
 * })) {
 *   if (chunk.type === 'content') setResponse(r => r + chunk.content);
 * }
 * ```
 */
export function useUnifiedInference(
  options: UseUnifiedInferenceOptions = {}
): UseUnifiedInferenceReturn {
  const {
    fallbackOrder = ['p2p', 'local', 'cloud'],
    healthCheckInterval = 30000,
    localBackend = 'webllm',
    cloudConfig,
    onProviderChange,
    onError,
  } = options;

  const { aiHub } = useAIHub();
  const { network } = useTrystero();
  
  const managerRef = useRef<ProviderManager | null>(null);
  const [activeProvider, setActiveProviderState] = useState<ProviderType | null>(null);
  const [availableProviders, setAvailableProviders] = useState<Array<{ type: ProviderType; provider: InferenceProvider; healthy: boolean }>>([]);
  const [healthStatus, setHealthStatus] = useState<Record<ProviderType, HealthStatus>>({
    p2p: { healthy: false, message: 'Not initialized' },
    local: { healthy: false, message: 'Not initialized' },
    cloud: { healthy: false, message: 'Not initialized' },
  });
  const [isInferring, setIsInferring] = useState(false);
  const [inferringProvider, setInferringProvider] = useState<ProviderType | null>(null);

  // ProviderManager 초기화
  useEffect(() => {
    const trysteroClient = (network as any)?.client || null;
    managerRef.current = new ProviderManager(aiHub, trysteroClient);
    
    // P2P를 기본으로 설정
    setActiveProviderState('p2p');
    
    // 클라우드 설정이 있으면 적용
    if (cloudConfig) {
      managerRef.current.setupCloudQuick(
        cloudConfig.provider,
        cloudConfig.apiKey,
        cloudConfig.model
      );
    }

    return () => {
      managerRef.current?.dispose();
    };
  }, [aiHub, network, cloudConfig]);

  // 사용 가능한 프로바이더 목록 업데이트
  const refreshProviders = useCallback(() => {
    const manager = managerRef.current;
    if (!manager) return;
    
    const providers = manager.getAvailableProviders();
    setAvailableProviders(providers);
  }, []);

  // 헬스체크
  const checkHealth = useCallback(async () => {
    const manager = managerRef.current;
    if (!manager) return;

    const results = await manager.checkAllHealth();
    setHealthStatus(results);

    // 첫 번째 건강한 프로바이더로 자동 전환
    for (const type of fallbackOrder) {
      if (results[type]?.healthy && activeProvider !== type) {
        setActiveProviderState(type);
        onProviderChange?.(type);
        break;
      }
    }
  }, [fallbackOrder, activeProvider, onProviderChange]);

  // 주기적 헬스체크
  useEffect(() => {
    checkHealth(); // 초기 체크
    const interval = setInterval(checkHealth, healthCheckInterval);
    return () => clearInterval(interval);
  }, [checkHealth, healthCheckInterval]);

  // 프로바이더 변경 시 사용 가능한 목록 갱신
  useEffect(() => {
    refreshProviders();
  }, [activeProvider, refreshProviders]);

  // 추론 실행 (자동 폴백 포함)
  const infer = useCallback(async function* (
    request: InferenceRequest
  ): AsyncGenerator<InferenceChunk> {
    const manager = managerRef.current;
    if (!manager) {
      yield { type: 'error', error: 'Provider manager not initialized' };
      return;
    }

    setIsInferring(true);
    setInferringProvider(activeProvider);

    try {
      // 요청에 모델 참조가 없으면 동반자 기본 모델 사용
      if (!request.companion.modelRef) {
        request.companion.modelRef = {
          type: activeProvider || 'p2p',
          ...(activeProvider === 'p2p' ? { cid: 'default' } : {}),
          ...(activeProvider === 'local' ? { localModelId: 'default' } : {}),
          ...(activeProvider === 'cloud' ? { cloudModel: 'default' } : {}),
        };
      }

      // 자동 폴백 추론
      for await (const chunk of manager.inferWithFallback(request)) {
        // 현재 사용 중인 프로바이더 추적
        if (chunk.type === 'content' && inferringProvider !== activeProvider) {
          setInferringProvider(activeProvider);
        }
        yield chunk;
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Inference failed');
      onError?.(err, activeProvider || 'unknown');
      yield { type: 'error', error: err.message };
    } finally {
      setIsInferring(false);
      setInferringProvider(null);
    }
  }, [activeProvider, inferringProvider, onError]);

  // 수동 프로바이더 변경
  const setActiveProvider = useCallback((type: ProviderType) => {
    const manager = managerRef.current;
    if (manager && manager.getAvailableProviders().some(p => p.type === type)) {
      manager.setActiveProvider(type);
      setActiveProviderState(type);
      onProviderChange?.(type);
    }
  }, [onProviderChange]);

  // 로컬 프로바이더 초기화
  const initLocal = useCallback(async (backend: 'webllm' | 'llamacpp' = 'webllm') => {
    const manager = managerRef.current;
    if (manager) {
      await manager.initLocal(backend);
      refreshProviders();
    }
  }, [refreshProviders]);

  // 클라우드 프로바이더 설정
  const setupCloud = useCallback((config: UseUnifiedInferenceOptions['cloudConfig']) => {
    const manager = managerRef.current;
    if (manager && config) {
      manager.setupCloudQuick(config.provider, config.apiKey, config.model);
      refreshProviders();
    }
  }, [refreshProviders]);

  // 정리
  const dispose = useCallback(async () => {
    const manager = managerRef.current;
    if (manager) {
      await manager.dispose();
      managerRef.current = null;
    }
  }, []);

  return {
    activeProvider,
    availableProviders,
    healthStatus,
    isInferring,
    inferringProvider,
    infer,
    setActiveProvider,
    checkHealth,
    initLocal,
    setupCloud,
    dispose,
  };
}

// 편의 훅: 간단한 채팅용
export function useChatInference(companion: UnifiedCompanion) {
  const { infer, isInferring, activeProvider, healthStatus } = useUnifiedInference();

  const sendMessage = useCallback(async (
    messages: InferenceRequest['messages'],
    onChunk?: (chunk: InferenceChunk) => void
  ) => {
    let fullResponse = '';
    
    for await (const chunk of infer({
      companion,
      messages,
      stream: true,
      temperature: 0.7,
      maxTokens: 512,
    })) {
      onChunk?.(chunk);
      if (chunk.type === 'content') {
        fullResponse += chunk.content;
      }
    }

    return fullResponse;
  }, [infer, companion]);

  return {
    sendMessage,
    isInferring,
    activeProvider,
    healthStatus,
  };
}