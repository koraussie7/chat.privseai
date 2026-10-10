/**
 * Character Card ↔ AIPackage Converter
 * 
 * OpenTamago 캐릭터 카드(SillyTavern 포맷)와 llmp2p AIPackage 간 양방향 변환을 제공합니다.
 * 캐릭터 생성, 공유, 마이그레이션 시 사용됩니다.
 */

import type { CharacterCard, CharacterCardData } from '@/types/character';
import type { AIPackage } from '@/types/ai-package';
import type { UnifiedCompanion, ModelReference, RelationshipProgress, GalleryItem, MemoryEntry } from '@/types/unified';
import { AIHub } from '@/lib/ai-hub';

/**
 * CharacterCardData를 UnifiedCompanion으로 변환
 * OpenTamago 캐릭터 → 통합 컴패니언
 */
export function characterCardToUnifiedCompanion(
  card: CharacterCard,
  options: {
    modelRef?: ModelReference;
    creator?: string;
    isPublic?: boolean;
  } = {}
): UnifiedCompanion {
  const data = card.data;
  const now = Date.now();
  const extensions = (data.extensions ?? {}) as Record<string, unknown>;
  const extGallery = Array.isArray(extensions.gallery) ? (extensions.gallery as string[]) : [];
  const extAvatar = typeof extensions.avatar === 'string' ? (extensions.avatar as string) : undefined;
  const extBanner = typeof extensions.banner === 'string' ? (extensions.banner as string) : undefined;
  const extNsfw = extensions.nsfw === true;
  const extAge = typeof extensions.age === 'string' ? (extensions.age as string) : undefined;
  const extGender = typeof extensions.gender === 'string' ? (extensions.gender as string) : undefined;
  const extVoice = typeof extensions.voice === 'string' ? (extensions.voice as string) : undefined;

  // 성격 특성 파싱
  const personality = parsePersonality(data.personality);
  const hobbies = parseHobbies(data.tags || []);

  // 관계 진행도 기본값
  const stage = typeof extensions.stage === 'number' ? extensions.stage : 1;
  const relationship: RelationshipProgress = {
    stage,
    xp: typeof extensions.xp === 'number' ? extensions.xp : 0,
    xpToNext: getXpForStage(stage),
    totalXp: typeof extensions.totalXp === 'number' ? extensions.totalXp : 0,
    unlockedContent: Array.isArray(extensions.unlockedContent) ? (extensions.unlockedContent as string[]) : [],
    milestones: [],
  };

  // 갤러리 변환
  const gallery: GalleryItem[] = extGallery.map((url, idx) => ({
    id: `${data.name}-gallery-${idx}`,
    type: 'image' as const,
    url,
    title: `${data.name} Gallery ${idx + 1}`,
    isUnlocked: true,
    isNSFW: extNsfw,
    createdAt: now,
  }));

  // 메모리 초기화 (캐릭터 카드에서 추출)
  const memory: MemoryEntry[] = extractMemoriesFromCard(data);

  return {
    id: card.data.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now().toString(36),
    name: data.name,
    tagline: data.description?.slice(0, 100),
    avatarUrl: extAvatar || data.src || '',
    bannerUrl: extBanner,
    systemPrompt: data.system_prompt || data.description || '',
    personality,
    hobbies,
    age: parseAge(extAge),
    gender: parseGender(extGender),
    category: parseCategory(data.tags || []),
    relationship,
    memory,
    modelRef: options.modelRef || { type: 'p2p', modelName: 'default' },
    capabilities: getDefaultCapabilities(extNsfw),
    gallery,
    voiceId: extVoice,
    greeting: data.first_mes || `Hello! I'm ${data.name}.`,
    createdAt: now,
    updatedAt: now,
    creator: options.creator || 'User',
    isPublic: options.isPublic ?? false,
    tags: data.tags || [],
  };
}

/**
 * UnifiedCompanion을 CharacterCard로 변환
 * 통합 컴패니언 → OpenTamago/SillyTavern 호환 캐릭터 카드
 */
export function unifiedCompanionToCharacterCard(companion: UnifiedCompanion): CharacterCard {
  return {
    spec: 'chara_card_v2',
    data: {
      name: companion.name,
      description: (companion.systemPrompt || companion.tagline || companion.name) as string,
      personality: companion.personality.join('\n'),
      scenario: '',
      first_mes: companion.greeting ?? '',
      mes_example: '',
      system_prompt: companion.systemPrompt ?? '',
      post_scriptment: '',
      creator: companion.creator || 'Unknown',
      character_version: '1.0',
      src: companion.avatarUrl ?? '',
      tags: companion.tags,
      creator_notes: '',
      extensions: {
        stage: companion.relationship.stage,
        xp: companion.relationship.xp,
        totalXp: companion.relationship.totalXp,
        unlockedContent: companion.relationship.unlockedContent,
        hobbies: companion.hobbies,
        modelRef: companion.modelRef,
      },
    },
  };
}

/**
 * AIPackage를 UnifiedCompanion으로 변환
 * llmp2p 패키지 → 통합 컴패니언
 */
export function aiPackageToUnifiedCompanion(pkg: AIPackage): UnifiedCompanion {
  const profile = AIHub.prototype.packageToProfile.call({} as any, pkg);
  const now = Date.now();

  // 갤러리 병합
  const galleryItems = pkg.media.gallery || [];
  const images = pkg.media.images || [];
  const videos = pkg.media.videos || [];

  const gallery: GalleryItem[] = [
    ...galleryItems.map((url, idx) => ({
      id: `${pkg.id}-gallery-${idx}`,
      type: 'image' as const,
      url,
      title: `${pkg.metadata.name} Gallery ${idx + 1}`,
      isUnlocked: true,
      isNSFW: Boolean(pkg.config.nsfwEnabled),
      createdAt: pkg.metadata.createdAt,
    })),
    ...images.map(img => ({
      id: img.id,
      type: 'image' as const,
      url: img.url,
      thumbnailUrl: img.thumbnailUrl,
      title: img.title,
      description: img.description,
      prompt: img.prompt,
      isUnlocked: true,
      isNSFW: img.isNSFW ?? false,
      metadata: {
        model: img.model,
        width: img.width,
        height: img.height,
        seed: img.seed,
        steps: img.steps,
        cfg: img.cfg,
        sampler: img.sampler,
        workflowId: img.workflowId,
        source: 'generated' as const,
      },
      createdAt: img.generatedAt || now,
    })),
    ...videos.map(vid => ({
      id: vid.id,
      type: 'video' as const,
      url: vid.url,
      thumbnailUrl: vid.thumbnailUrl,
      title: vid.title,
      description: vid.description,
      prompt: vid.prompt,
      isUnlocked: true,
      isNSFW: vid.isNSFW ?? false,
      metadata: {
        model: vid.model,
        width: vid.width,
        height: vid.height,
        fps: vid.fps,
        source: 'generated' as const,
      },
      createdAt: vid.generatedAt || now,
    })),
  ];

  return {
    id: pkg.id,
    name: pkg.metadata.name,
    tagline: pkg.metadata.description,
    avatarUrl: pkg.media.avatarUrl || pkg.card.data.src || '',
    bannerUrl: pkg.media.bannerUrl,
    systemPrompt: pkg.config.systemPrompt,
    personality: pkg.card.data.personality.split(/[\n,]/).map(s => s.trim()).filter(Boolean),
    hobbies: pkg.metadata.tags,
    age: profile.age,
    gender: 'female', // TODO: 캐릭터 카드에서 파싱
    category: pkg.metadata.category as any,
    relationship: {
      stage: profile.stage,
      xp: 0,
      xpToNext: getXpForStage(profile.stage),
      totalXp: 0,
      unlockedContent: [],
      milestones: [],
    },
    memory: [], // TODO: 메모리 시스템 연동
    modelRef: pkg.modelCid ? { type: 'p2p', cid: pkg.modelCid, modelName: pkg.metadata.baseModel } : { type: 'local', localModelId: 'default' },
    capabilities: {
      chat: true,
      imageGeneration: !!pkg.config.comfyuiUrl,
      videoGeneration: !!(pkg.media.videos?.length),
      voice: !!pkg.media.voiceId,
      memory: true,
      tools: pkg.tools.length > 0,
      p2pSync: true,
      nsfw: pkg.config.nsfwEnabled ?? false,
      multimodal: false,
    },
    gallery,
    voiceId: pkg.media.voiceId,
    greeting: pkg.card.data.first_mes,
    createdAt: pkg.metadata.createdAt,
    updatedAt: pkg.metadata.updatedAt,
    creator: pkg.metadata.creator,
    isPublic: pkg.metadata.isPublic,
    tags: pkg.metadata.tags,
  };
}

/**
 * UnifiedCompanion을 AIPackage로 변환
 * 통합 컴패니언 → llmp2p 패키지
 */
export function unifiedCompanionToAIPackage(
  companion: UnifiedCompanion,
  aiHub: AIHub
): AIPackage {
  // CharacterCard 생성
  const card = unifiedCompanionToCharacterCard(companion);

  // AIPackage 생성 옵션 구성
  const pkg = aiHub.createPackage({
    card,
    name: companion.name,
    description: companion.tagline || companion.systemPrompt,
    creator: companion.creator,
    baseModel: companion.modelRef.type === 'p2p' 
      ? (companion.modelRef.modelName || 'Qwen3-0.6B')
      : 'Qwen3-0.6B',
    tags: companion.tags ?? [],
    category: (['realistic','anime','cyber','fantasy'].includes(companion.category ?? '') ? companion.category : 'other') as 'other'|'realistic'|'anime'|'cyber'|'fantasy',
    media: {
      avatarUrl: companion.avatarUrl,
      bannerUrl: companion.bannerUrl,
      voiceId: companion.voiceId,
    },
    config: {
      systemPrompt: companion.systemPrompt,
      nsfwEnabled: companion.capabilities.nsfw,
      maxTokens: 2048,
      temperature: 0.7,
      topP: 0.9,
      frequencyPenalty: 0.3,
      presencePenalty: 0.3,
      mindToolsEnabled: companion.capabilities.tools,
    },
  });

  // 모델 CID 설정
  if (companion.modelRef.type === 'p2p' && companion.modelRef.cid) {
    pkg.modelCid = companion.modelRef.cid;
  }

  // 갤러리 아이템 동기화
  pkg.galleryItems = companion.gallery.map((g): import('@/types/ai-package').GalleryItem => ({
    id: g.id,
    type: g.type,
    url: g.url,
    thumbnailUrl: g.thumbnailUrl,
    title: g.title,
    description: g.description || '',
    isUnlocked: g.isUnlocked,
    requiredStage: g.requiredStage,
    prompt: g.prompt,
    duration: g.metadata?.width ? undefined : undefined,
    isNSFW: g.isNSFW,
    metadata: g.metadata as unknown as Record<string, unknown> | undefined,
  }));

  return pkg;
}

/**
 * 캐릭터 카드에서 성격 특성 파싱
 */
function parsePersonality(personality: string): string[] {
  if (!personality) return [];
  return personality
    .split(/[\n,;]/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && s.length < 50)
    .slice(0, 10);
}

/**
 * 캐릭터 카드에서 취미/태그 파싱
 */
function parseHobbies(tags: string[]): string[] {
  const hobbyKeywords = ['hobby', 'interest', 'like', 'enjoy', 'love', 'passion'];
  return tags
    .filter(tag => hobbyKeywords.some(kw => tag.toLowerCase().includes(kw)))
    .slice(0, 5);
}

/**
 * 나이 파싱
 */
function parseAge(age: string | number | undefined): number | undefined {
  if (!age) return undefined;
  const num = typeof age === 'string' ? parseInt(age, 10) : age;
  return isNaN(num) ? undefined : num;
}

/**
 * 성별 파싱
 */
function parseGender(gender: string | undefined): 'female' | 'male' | 'non-binary' | 'other' | undefined {
  if (!gender) return undefined;
  const g = gender.toLowerCase();
  if (['female', 'woman', 'girl', 'f'].includes(g)) return 'female';
  if (['male', 'man', 'boy', 'm'].includes(g)) return 'male';
  if (['non-binary', 'nonbinary', 'enby', 'nb'].includes(g)) return 'non-binary';
  return 'other';
}

/**
 * 카테고리 추론
 */
function parseCategory(tags: string[]): 'realistic' | 'anime' | 'cyber' | 'fantasy' | 'historical' | 'scifi' | 'slice-of-life' {
  const tagLower = tags.map(t => t.toLowerCase());
  
  if (tagLower.some(t => ['anime', 'manga', 'japanese', '2d'].includes(t))) return 'anime';
  if (tagLower.some(t => ['cyber', 'cyberpunk', 'sci-fi', 'scifi', 'futuristic', 'tech'].includes(t))) return 'cyber';
  if (tagLower.some(t => ['fantasy', 'magic', 'medieval', 'dragon', 'elf', 'wizard'].includes(t))) return 'fantasy';
  if (tagLower.some(t => ['historical', 'period', 'victorian', 'edo', 'ancient'].includes(t))) return 'historical';
  if (tagLower.some(t => ['slice of life', 'daily', 'school', 'workplace', 'romance'].includes(t))) return 'slice-of-life';
  
  return 'realistic';
}

/**
 * 단계별 필요 XP 계산
 */
function getXpForStage(stage: number): number {
  const baseXp = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500];
  return baseXp[stage] || stage * 500;
}

/**
 * 기본 능력 플래그
 */
function getDefaultCapabilities(nsfw: boolean) {
  return {
    chat: true,
    imageGeneration: false,
    videoGeneration: false,
    voice: false,
    memory: true,
    tools: false,
    p2pSync: true,
    nsfw,
    multimodal: false,
  };
}

/**
 * 캐릭터 카드에서 메모리 추출
 */
function extractMemoriesFromCard(data: CharacterCardData): MemoryEntry[] {
  const memories: MemoryEntry[] = [];
  const now = Date.now();

  // 설명에서 사실 추출
  if (data.description) {
    memories.push({
      id: `mem-desc-${Date.now()}`,
      type: 'fact',
      content: data.description,
      importance: 80,
      tags: ['description', 'identity'],
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 0,
      source: 'system',
    });
  }

  // 성격에서 선호도 추출
  if (data.personality) {
    const traits = parsePersonality(data.personality);
    traits.forEach((trait, idx) => {
      memories.push({
        id: `mem-personality-${idx}`,
        type: 'preference',
        content: `Personality trait: ${trait}`,
        importance: 70,
        tags: ['personality', trait.toLowerCase()],
        createdAt: now,
        lastAccessedAt: now,
        accessCount: 0,
        source: 'system',
      });
    });
  }

  // 첫 메시지에서 관계 설정 추출
  if (data.first_mes) {
    memories.push({
      id: `mem-greeting-${Date.now()}`,
      type: 'event',
      content: `First greeting: ${data.first_mes.slice(0, 200)}`,
      importance: 60,
      tags: ['greeting', 'introduction'],
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 0,
      source: 'system',
    });
  }

  return memories;
}

/**
 * AIPackage 배열을 UnifiedCompanion 배열로 일괄 변환
 */
export function aiPackagesToUnifiedCompanions(packages: AIPackage[]): UnifiedCompanion[] {
  return packages.map(aiPackageToUnifiedCompanion);
}

/**
 * UnifiedCompanion 배열을 AIPackage 배열로 일괄 변환
 */
export function unifiedCompanionsToAIPackages(
  companions: UnifiedCompanion[],
  aiHub: AIHub
): AIPackage[] {
  return companions.map(c => unifiedCompanionToAIPackage(c, aiHub));
}

/**
 * 모델 참조 자동 결정
 * 캐릭터의 요구사항에 따라 최적의 모델 소스 타입 선택
 */
export function determineOptimalModelRef(
  companion: Partial<UnifiedCompanion>,
  availableModels: {
    p2p: ModelReference[];
    local: ModelReference[];
    cloud: ModelReference[];
  }
): ModelReference {
  // NSFW 필요 시 로컬/클라우드 우선 (P2P 모델은 검증 필요)
  if (companion.capabilities?.nsfw) {
    if (availableModels.local.length > 0) {
      return availableModels.local[0];
    }
    if (availableModels.cloud.length > 0) {
      return availableModels.cloud[0];
    }
  }

  // 도구 사용 필요 시 클라우드 우선 (function calling 지원)
  if (companion.capabilities?.tools) {
    if (availableModels.cloud.length > 0) {
      return availableModels.cloud[0];
    }
  }

  // 멀티모달 필요 시 클라우드 우선
  if (companion.capabilities?.multimodal) {
    if (availableModels.cloud.length > 0) {
      return availableModels.cloud[0];
    }
  }

  // 기본: P2P 모델 사용 (분산 추론 이점)
  if (availableModels.p2p.length > 0) {
    return availableModels.p2p[0];
  }

  // 폴백: 로컬
  if (availableModels.local.length > 0) {
    return availableModels.local[0];
  }

  // 최종 폴백: 클라우드
  return availableModels.cloud[0] || { type: 'cloud', cloudProvider: 'openai', cloudModel: 'gpt-4o-mini' };
}