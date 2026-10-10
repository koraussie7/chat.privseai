/**
 * PrivseAI Integration Adapter
 * 
 * 기존 privseai-trystero 프론트엔드에 통합 추론 시스템을 연결합니다.
 * App.tsx, AIHubPage.tsx, CandyChatPage.tsx 등에 ProviderManager를 주입합니다.
 */

import { useEffect, useState, useCallback, createContext, useContext, ReactNode } from 'react';
import { useAIHub } from '@/hooks/useAIHub';
import { useTrystero } from '@/hooks/useTrysteroP2P';
import type { UnifiedCompanion, InferenceRequest, InferenceChunk, ProviderType } from '@/types/unified';
import { ProviderManager } from '@/lib/providers';
import { unifiedCompanionToAIPackage, aiPackageToUnifiedCompanion } from '@/lib/converters';

// ============================================================================
// React Context for Global Provider Access
// ============================================================================

interface IntegrationContextValue {
  providerManager: ProviderManager | null;
  activeProvider: ProviderType | null;
  isInferring: boolean;
  infer: (request: InferenceRequest) => AsyncGenerator<InferenceChunk>;
  setActiveProvider: (type: ProviderType) => void;
  initLocal: (backend?: 'webllm' | 'llamacpp') => Promise<void>;
  setupCloud: (config: { provider: string; apiKey: string; model?: string }) => void;
  convertCompanion: (companion: UnifiedCompanion) => any; // AIPackage
  restoreCompanion: (pkg: any) => UnifiedCompanion;
}

const IntegrationContext = createContext<IntegrationContextValue | null>(null);

export function useIntegration(): IntegrationContextValue {
  const context = useContext(IntegrationContext);
  if (!context) {
    throw new Error('useIntegration must be used within IntegrationProvider');
  }
  return context;
}

// ============================================================================
// Integration Provider Component
// ============================================================================

interface IntegrationProviderProps {
  children: ReactNode;
  cloudConfig?: {
    provider: 'openai' | 'anthropic' | 'groq' | 'together';
    apiKey: string;
    model?: string;
  };
  autoInitLocal?: boolean;
  localBackend?: 'webllm' | 'llamacpp';
}

export function IntegrationProvider({
  children,
  cloudConfig,
  autoInitLocal = false,
  localBackend = 'webllm',
}: IntegrationProviderProps) {
  const { aiHub } = useAIHub();
  const { network } = useTrystero();
  
  const [providerManager, setProviderManager] = useState<ProviderManager | null>(null);
  const [activeProvider, setActiveProviderState] = useState<ProviderType | null>('p2p');
  const [isInferring, setIsInferring] = useState(false);

  // ProviderManager 초기화
  useEffect(() => {
    const trysteroClient = (network as any)?.client || null;
    const manager = new ProviderManager(aiHub, trysteroClient);
    setProviderManager(manager);

    // 클라우드 설정 적용
    if (cloudConfig) {
      manager.setupCloudQuick(cloudConfig.provider, cloudConfig.apiKey, cloudConfig.model);
    }

    // 로컬 자동 초기화
    if (autoInitLocal) {
      manager.initLocal(localBackend).catch(console.error);
    }

    return () => { void manager.dispose(); };
  }, [aiHub, network, cloudConfig, autoInitLocal, localBackend]);

  // 추론 실행
  const infer = useCallback(async function* (
    request: InferenceRequest
  ): AsyncGenerator<InferenceChunk> {
    if (!providerManager) {
      yield { type: 'error', error: 'Provider manager not initialized' };
      return;
    }

    setIsInferring(true);
    setActiveProviderState(activeProvider);

    try {
      for await (const chunk of providerManager.inferWithFallback(request)) {
        yield chunk;
      }
    } catch (error) {
      yield { type: 'error', error: error instanceof Error ? error.message : 'Inference failed' };
    } finally {
      setIsInferring(false);
    }
  }, [providerManager, activeProvider]);

  // 프로바이더 변경
  const setActiveProvider = useCallback((type: ProviderType) => {
    if (providerManager) {
      providerManager.setActiveProvider(type);
      setActiveProviderState(type);
    }
  }, [providerManager]);

  // 로컬 초기화
  const initLocal = useCallback(async (backend: 'webllm' | 'llamacpp' = 'webllm') => {
    if (providerManager) {
      await providerManager.initLocal(backend);
    }
  }, [providerManager]);

  // 클라우드 설정
  const setupCloud = useCallback((config: { provider: string; apiKey: string; model?: string }) => {
    if (providerManager) {
      providerManager.setupCloudQuick(config.provider as any, config.apiKey, config.model);
    }
  }, [providerManager]);

  // 변환 유틸리티
  const convertCompanion = useCallback((companion: UnifiedCompanion) => {
    return unifiedCompanionToAIPackage(companion, aiHub);
  }, [aiHub]);

  const restoreCompanion = useCallback((pkg: any) => {
    return aiPackageToUnifiedCompanion(pkg);
  }, []);

  const value: IntegrationContextValue = {
    providerManager,
    activeProvider,
    isInferring,
    infer,
    setActiveProvider,
    initLocal,
    setupCloud,
    convertCompanion,
    restoreCompanion,
  };

  return (
    <IntegrationContext.Provider value={value}>
      {children}
    </IntegrationContext.Provider>
  );
}

// ============================================================================
// Hook: useUnifiedChat - 기존 CompanionChat에서 바로 사용 가능
// ============================================================================

export function useUnifiedChat(companion: UnifiedCompanion) {
  const { infer, isInferring, activeProvider, setActiveProvider, initLocal, setupCloud } = useIntegration();

  const sendMessage = useCallback(async (
    messages: InferenceRequest['messages'],
    onChunk?: (chunk: InferenceChunk) => void,
    options?: { temperature?: number; maxTokens?: number; tools?: any[] }
  ) => {
    let fullResponse = '';
    
    for await (const chunk of infer({
      companion,
      messages,
      stream: true,
      temperature: options?.temperature ?? 0.7,
      maxTokens: options?.maxTokens ?? 512,
      tools: options?.tools,
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
    setActiveProvider,
    initLocal,
    setupCloud,
  };
}

// ============================================================================
// Hook: useModelSelector - 모델/프로바이더 선택 UI용
// ============================================================================

export function useModelSelector() {
  const { providerManager, activeProvider } = useIntegration();
  const availableProviders = providerManager?.getAvailableProviders() ?? [];
  const healthStatus: Record<string, { latencyMs?: number }> = {};
  const checkHealth = () => providerManager?.checkAllHealth();

  const providers = availableProviders.map(p => ({
    type: p.type,
    name: p.provider.name,
    description: p.provider.description,
    healthy: p.healthy,
    latency: healthStatus[p.type]?.latencyMs,
  }));

  return {
    activeProvider,
    providers,
    healthStatus,
    setActiveProvider: useIntegration().setActiveProvider,
    checkHealth,
    initLocal: useIntegration().initLocal,
    setupCloud: useIntegration().setupCloud,
  };
}

// ============================================================================
// Migration Helper: Existing CandyCompanion → UnifiedCompanion
// ============================================================================

import type { CandyCompanion } from '@/data/candyPresets';

export function candyCompanionToUnified(companion: CandyCompanion): UnifiedCompanion {
  const now = Date.now();
  
  return {
    id: companion.id,
    name: companion.name,
    tagline: companion.tagline,
    avatarUrl: companion.avatarUrl,
    bannerUrl: companion.bannerUrl,
    systemPrompt: companion.bio || '',
    personality: companion.personality || [],
    hobbies: companion.hobbies || [],
    age: companion.age,
    gender: 'female', // CandyCompanion에는 gender 필드 없음
    category: companion.category as any,
    relationship: {
      stage: companion.stage,
      xp: 0,
      xpToNext: getXpForStage(companion.stage),
      totalXp: 0,
      unlockedContent: companion.gallery
        .filter(g => g.isUnlocked)
        .map(g => g.id),
      milestones: [],
    },
    memory: [],
    modelRef: { type: 'p2p', modelName: 'default' },
    capabilities: {
      chat: true,
      imageGeneration: false,
      videoGeneration: false,
      voice: companion.hasVoice,
      memory: true,
      tools: false,
      p2pSync: true,
      nsfw: companion.gallery.some(g => g.isNSFW),
      multimodal: false,
    },
    gallery: companion.gallery.map(g => ({
      id: g.id,
      type: 'image' as const,
      url: g.url,
      title: g.title,
      isUnlocked: g.isUnlocked,
      requiredStage: g.requiredStage,
      isNSFW: g.isNSFW ?? false,
      createdAt: now,
    })),
    voiceId: companion.voiceAudioUrl,
    greeting: companion.greeting,
    createdAt: now,
    updatedAt: now,
    creator: 'PrivseAI',
    isPublic: false,
    tags: [...(companion.hobbies || []), ...(companion.personality || [])],
  };
}

function getXpForStage(stage: number): number {
  const baseXp = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500];
  return baseXp[stage] || stage * 500;
}

// ============================================================================
// Migration Helper: UnifiedCompanion → CandyCompanion (for backward compat)
// ============================================================================

export function unifiedToCandyCompanion(companion: UnifiedCompanion): CandyCompanion {
  return {
    id: companion.id,
    name: companion.name,
    tagline: companion.tagline || '',
    age: companion.age || 22,
    category: (companion.category === 'anime' ? 'anime' : 'realistic'),
    gender: 'female',
    isOnline: true,
    hasVoice: !!companion.voiceId,
    avatarUrl: companion.avatarUrl,
    bio: companion.systemPrompt,
    relationship: '친구',
    occupation: 'AI 동반자',
    hobbies: companion.hobbies || [],
    personality: companion.personality,
    stage: companion.relationship.stage,
    greeting: companion.greeting || `안녕, 나는 ${companion.name}이야!`,
    voiceAudioUrl: companion.voiceId,
    gallery: companion.gallery.map(g => ({
      id: g.id,
      url: g.url,
      title: g.title,
      isUnlocked: g.isUnlocked,
      requiredStage: g.requiredStage,
      isNSFW: g.isNSFW,
    })),
    scenarios: [],
  };
}