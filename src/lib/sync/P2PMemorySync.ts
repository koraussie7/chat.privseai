/**
 * P2P Memory Sync using Yjs CRDT
 * 
 * 다중 디바이스/피어 간 캐릭터 상태(메모리, 관계, 갤러리)를 
 * 충돌 없이 동기화합니다. 오프라인 우선, 온라인 시 자동 병합.
 */

import * as Y from 'yjs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { WebrtcProvider } from 'y-webrtc';
import { IndexeddbPersistence } from 'y-indexeddb';
import type {
  UnifiedCompanion,
  MemoryEntry,
  RelationshipProgress,
  GalleryItem,
  SyncState,
  SyncOperation,
} from '@/types/unified';

export interface P2PSyncConfig {
  companionId: string;
  signalingServers?: string[];  // WebRTC 시그널링 서버
  roomName?: string;            // 동기화 룸 이름
  maxRetries?: number;
  retryDelayMs?: number;
}

export interface SyncCallbacks {
  onSyncStateChange?: (state: SyncState) => void;
  onConflict?: (operations: SyncOperation[]) => void;
  onRemoteUpdate?: (companion: Partial<UnifiedCompanion>) => void;
  onError?: (error: Error) => void;
}

/**
 * P2P 메모리/상태 동기화 관리자
 * Yjs CRDT를 사용하여 충돌 없는 병합 보장
 */
export class P2PMemorySync {
  private doc: Y.Doc;
  private provider: WebrtcProvider | null = null;
  private persistence: IndexeddbPersistence | null = null;
  
  // Yjs 타입들
  private yMemory: Y.Array<MemoryEntry>;
  private yRelationship: Y.Map<any>;
  private yGallery: Y.Array<GalleryItem>;
  private yMetadata: Y.Map<any>;  // name, systemPrompt, personality 등
  private ySyncState: Y.Map<any>;
  
  private companionId: string;
  private config: Required<P2PSyncConfig>;
  private callbacks: SyncCallbacks;
  private isConnected = false;
  private peerCount = 0;
  private pendingOperations: SyncOperation[] = [];
  private vectorClock: Record<string, number> = {};

  constructor(config: P2PSyncConfig, callbacks: SyncCallbacks = {}) {
    this.companionId = config.companionId;
    this.config = {
      companionId: config.companionId,
      signalingServers: config.signalingServers || [
        'wss://signaling.privseai.com',
        'wss://global.yjs.dev',
      ],
      roomName: config.roomName || `companion-sync-${config.companionId}`,
      maxRetries: config.maxRetries ?? 5,
      retryDelayMs: config.retryDelayMs ?? 2000,
    };
    this.callbacks = callbacks;

    // Yjs 문서 초기화
    this.doc = new Y.Doc();
    this.yMemory = this.doc.getArray<MemoryEntry>('memory');
    this.yRelationship = this.doc.getMap('relationship');
    this.yGallery = this.doc.getArray<GalleryItem>('gallery');
    this.yMetadata = this.doc.getMap('metadata');
    this.ySyncState = this.doc.getMap('syncState');

    this.setupEventListeners();
    this.initPersistence();
    this.initWebRTCProvider();
  }

  private setupEventListeners(): void {
    // 메모리 변경 감지
    this.yMemory.observe(event => {
      this.handleLocalChange('memory', event);
    });

    // 관계 변경 감지
    this.yRelationship.observe(event => {
      this.handleLocalChange('relationship', event);
    });

    // 갤러리 변경 감지
    this.yGallery.observe(event => {
      this.handleLocalChange('gallery', event);
    });

    // 메타데이터 변경 감지
    this.yMetadata.observe(event => {
      this.handleLocalChange('metadata', event);
    });
  }

  private async initPersistence(): Promise<void> {
    try {
      this.persistence = new IndexeddbPersistence(`companion-${this.companionId}`, this.doc);
      await this.persistence.whenSynced;
      console.log('[P2PSync] IndexedDB persistence loaded');
    } catch (error) {
      console.warn('[P2PSync] IndexedDB unavailable:', error);
    }
  }

  private initWebRTCProvider(): void {
    try {
      this.provider = new WebrtcProvider(this.config.roomName, this.doc, {
        signaling: this.config.signalingServers,
        maxConns: 10,
      });

      this.provider.on('status', (event: { connected: boolean }) => {
        this.isConnected = event.connected;
        this.updateSyncStatus(event.connected ? 'idle' : 'error', 
          event.connected ? undefined : 'Disconnected from signaling');
        this.callbacks.onSyncStateChange?.(this.getSyncState());
      });

      this.provider.on('peers', (event: { webrtcPeers: string[]; bcPeers: string[] }) => {
        // y-webrtc reports peers via this event; there is no getPeers().
        this.peerCount = event.webrtcPeers.length;
        console.log('[P2PSync] Peers:', this.peerCount);
        this.callbacks.onSyncStateChange?.(this.getSyncState());
      });

      this.provider.on('synced', (event: { synced: boolean }) => {
        if (event.synced) {
          this.updateSyncStatus('idle');
          this.pushPendingOperations();
        }
      });
    } catch (error) {
      console.error('[P2PSync] WebRTC provider init failed:', error);
      this.callbacks.onError?.(error instanceof Error ? error : new Error('WebRTC init failed'));
    }
  }

  private handleLocalChange(entityType: string, event: Y.YEvent<any>): void {
    if (event.transaction.origin !== null) return; // 로컬 변경만 처리

    const operation: SyncOperation = {
      id: `${this.companionId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: 'update',
      entityType: entityType as any,
      entityId: this.companionId,
      data: this.getEntityData(entityType),
      timestamp: Date.now(),
      vectorClock: { ...this.vectorClock },
    };

    this.pendingOperations.push(operation);
    this.incrementVectorClock();

    if (this.isConnected) {
      this.pushPendingOperations();
    }
  }

  private getEntityData(entityType: string): any {
    switch (entityType) {
      case 'memory': return this.yMemory.toArray();
      case 'relationship': return Object.fromEntries(this.yRelationship.entries());
      case 'gallery': return this.yGallery.toArray();
      case 'metadata': return Object.fromEntries(this.yMetadata.entries());
      default: return null;
    }
  }

  private incrementVectorClock(): void {
    this.vectorClock[this.companionId] = (this.vectorClock[this.companionId] || 0) + 1;
  }

  private pushPendingOperations(): void {
    if (!this.isConnected || this.pendingOperations.length === 0) return;
    
    // Yjs가 자동으로 브로드캐스트하므로 별도 푸시 불필요
    // 여기서는 벡터 클록 업데이트만
    this.pendingOperations = [];
  }

  private updateSyncStatus(status: SyncState['status'], error?: string): void {
    this.ySyncState.set('status', status);
    this.ySyncState.set('lastSyncedAt', Date.now());
    if (error) this.ySyncState.set('error', error);
    this.callbacks.onSyncStateChange?.(this.getSyncState());
  }

  // ========================================================================
  // Public API
  // ========================================================================

  /**
   * 전체 컴패니언 상태를 동기화 문서에 로드
   */
  loadCompanion(companion: UnifiedCompanion): void {
    this.doc.transact(() => {
      // 메모리
      this.yMemory.delete(0, this.yMemory.length);
      companion.memory.forEach(m => this.yMemory.push([m]));

      // 관계
      this.yRelationship.clear();
      Object.entries(companion.relationship).forEach(([k, v]) => {
        this.yRelationship.set(k, v);
      });

      // 갤러리
      this.yGallery.delete(0, this.yGallery.length);
      companion.gallery.forEach(g => this.yGallery.push([g]));

      // 메타데이터
      this.yMetadata.clear();
      const metadata = {
        name: companion.name,
        tagline: companion.tagline,
        avatarUrl: companion.avatarUrl,
        bannerUrl: companion.bannerUrl,
        systemPrompt: companion.systemPrompt,
        personality: companion.personality,
        hobbies: companion.hobbies,
        age: companion.age,
        gender: companion.gender,
        category: companion.category,
        capabilities: companion.capabilities,
        voiceId: companion.voiceId,
        greeting: companion.greeting,
        tags: companion.tags,
        modelRef: companion.modelRef,
      };
      Object.entries(metadata).forEach(([k, v]) => {
        this.yMetadata.set(k, v);
      });

      // 동기화 상태 초기화
      this.ySyncState.set('status', 'idle');
      this.ySyncState.set('lastSyncedAt', Date.now());
      this.ySyncState.set('pendingChanges', 0);
      this.ySyncState.set('conflictCount', 0);
    });
  }

  /**
   * 현재 동기화된 컴패니언 상태 반환
   */
  getCompanion(): Partial<UnifiedCompanion> {
    return {
      id: this.companionId,
      name: this.yMetadata.get('name'),
      tagline: this.yMetadata.get('tagline'),
      avatarUrl: this.yMetadata.get('avatarUrl'),
      bannerUrl: this.yMetadata.get('bannerUrl'),
      systemPrompt: this.yMetadata.get('systemPrompt'),
      personality: this.yMetadata.get('personality') || [],
      hobbies: this.yMetadata.get('hobbies'),
      age: this.yMetadata.get('age'),
      gender: this.yMetadata.get('gender'),
      category: this.yMetadata.get('category'),
      capabilities: this.yMetadata.get('capabilities'),
      voiceId: this.yMetadata.get('voiceId'),
      greeting: this.yMetadata.get('greeting'),
      tags: this.yMetadata.get('tags') || [],
      modelRef: this.yMetadata.get('modelRef'),
      memory: this.yMemory.toArray(),
      relationship: Object.fromEntries(this.yRelationship.entries()) as RelationshipProgress,
      gallery: this.yGallery.toArray(),
    };
  }

  /**
   * 메모리 추가/업데이트
   */
  upsertMemory(entry: MemoryEntry): void {
    this.doc.transact(() => {
      const existingIdx = this.yMemory.toArray().findIndex(m => m.id === entry.id);
      if (existingIdx >= 0) {
        this.yMemory.delete(existingIdx, 1);
        this.yMemory.insert(existingIdx, [entry]);
      } else {
        this.yMemory.push([entry]);
      }
    });
  }

  /**
   * 메모리 삭제
   */
  deleteMemory(id: string): void {
    this.doc.transact(() => {
      const idx = this.yMemory.toArray().findIndex(m => m.id === id);
      if (idx >= 0) this.yMemory.delete(idx, 1);
    });
  }

  /**
   * 관계 진행도 업데이트
   */
  updateRelationship(updates: Partial<RelationshipProgress>): void {
    this.doc.transact(() => {
      Object.entries(updates).forEach(([k, v]) => {
        this.yRelationship.set(k, v);
      });
    });
  }

  /**
   * XP 증가 및 단계 체크
   */
  addXP(amount: number): { leveledUp: boolean; newStage: number } {
    const currentXP = this.yRelationship.get('xp') || 0;
    const currentStage = this.yRelationship.get('stage') || 1;
    const xpToNext = this.yRelationship.get('xpToNext') || 100;
    const totalXP = (this.yRelationship.get('totalXp') || 0) + amount;
    const newXP = currentXP + amount;

    let newStage = currentStage;
    let leveledUp = false;
    let remainingXP = newXP;
    let nextThreshold = xpToNext;

    while (remainingXP >= nextThreshold) {
      remainingXP -= nextThreshold;
      newStage++;
      leveledUp = true;
      nextThreshold = Math.floor(nextThreshold * 1.5); // 단계별 증가
    }

    this.doc.transact(() => {
      this.yRelationship.set('xp', remainingXP);
      this.yRelationship.set('stage', newStage);
      this.yRelationship.set('xpToNext', nextThreshold);
      this.yRelationship.set('totalXp', totalXP);
    });

    return { leveledUp, newStage };
  }

  /**
   * 갤러리 아이템 추가
   */
  addGalleryItem(item: GalleryItem): void {
    this.doc.transact(() => {
      this.yGallery.push([item]);
    });
  }

  /**
   * 갤러리 아이템 업데이트 (잠금 해제 등)
   */
  updateGalleryItem(id: string, updates: Partial<GalleryItem>): void {
    this.doc.transact(() => {
      const items = this.yGallery.toArray();
      const idx = items.findIndex(g => g.id === id);
      if (idx >= 0) {
        const updated = { ...items[idx], ...updates };
        this.yGallery.delete(idx, 1);
        this.yGallery.insert(idx, [updated]);
      }
    });
  }

  /**
   * 콘텐츠 해금 (단계 도달 시)
   */
  unlockContent(contentId: string): void {
    this.doc.transact(() => {
      const unlocked = (this.yRelationship.get('unlockedContent') as string[]) || [];
      if (!unlocked.includes(contentId)) {
        unlocked.push(contentId);
        this.yRelationship.set('unlockedContent', unlocked);
      }
    });
  }

  /**
   * 마일스톤 추가
   */
  addMilestone(milestone: { id: string; title: string; description: string; rewardType: string; rewardRef: string }): void {
    this.doc.transact(() => {
      const milestones = (this.yRelationship.get('milestones') as any[]) || [];
      milestones.push({
        ...milestone,
        achievedAt: Date.now(),
      });
      this.yRelationship.set('milestones', milestones);
    });
  }

  /**
   * 현재 동기화 상태 반환
   */
  getSyncState(): SyncState {
    return {
      companionId: this.companionId,
      lastSyncedAt: this.ySyncState.get('lastSyncedAt') || 0,
      pendingChanges: this.pendingOperations.length,
      conflictCount: this.ySyncState.get('conflictCount') || 0,
      status: this.ySyncState.get('status') || 'idle',
      error: this.ySyncState.get('error'),
    };
  }

  /**
   * 연결 상태 확인
   */
  isOnline(): boolean {
    return this.isConnected && this.provider?.connected === true;
  }

  /**
   * 연결된 피어 수
   */
  getPeerCount(): number {
    return this.provider ? this.peerCount : 0;
  }

  /**
   * 강제 동기화 (수동 트리거)
   */
  async forceSync(): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Not connected to P2P network');
    }
    this.updateSyncStatus('syncing');
    // Yjs가 자동 동기화하므로 대기만
    await new Promise(resolve => setTimeout(resolve, 1000));
    this.updateSyncStatus('idle');
  }

  /**
   * 충돌 해결 (수동 병합 필요 시)
   */
  resolveConflict(operations: SyncOperation[], resolution: 'local' | 'remote' | 'merge'): void {
    this.ySyncState.set('conflictCount', Math.max(0, (this.ySyncState.get('conflictCount') || 0) - operations.length));
    
    if (resolution === 'local') {
      // 로컬 유지 (이미 로컬이 우선이므로 아무것도 안 함)
    } else if (resolution === 'remote') {
      // 원격 데이터로 덮어쓰기 - Yjs는 자동 병합하므로 보통 불필요
    } else if (resolution === 'merge') {
      // 커스텀 병합 로직 필요 시 구현
    }
    this.callbacks.onConflict?.([]);
  }

  /**
   * 정리
   */
  destroy(): void {
    this.provider?.destroy();
    this.persistence?.destroy();
    this.doc.destroy();
  }
}

/**
 * React 훅: P2P 동기화 쉽게 사용
 */
export function useP2PSync(
  companionId: string,
  initialCompanion?: UnifiedCompanion,
  hookCallbacks?: SyncCallbacks,
) {
  const syncRef = useRef<P2PMemorySync | null>(null);
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [ready, setReady] = useState(false);
  const [peerCount, setPeerCount] = useState(0);

  // The client wires up Yjs + IndexedDB asynchronously and is not safe to
  // construct during render, so creation is an explicit async call.
  const createSync = useCallback(
    async (callbacks?: SyncCallbacks): Promise<P2PMemorySync> => {
      if (syncRef.current) return syncRef.current;
      const instance = new P2PMemorySync(
        { companionId, roomName: `companion-${companionId}` },
        {
          ...hookCallbacks,
          ...callbacks,
          onSyncStateChange: (state) => {
            setSyncState(state);
            setPeerCount(instance.getPeerCount());
            hookCallbacks?.onSyncStateChange?.(state);
            callbacks?.onSyncStateChange?.(state);
          },
        },
      );
      if (initialCompanion) instance.loadCompanion(initialCompanion);
      syncRef.current = instance;
      setReady(true);
      setSyncState(instance.getSyncState());
      setPeerCount(instance.getPeerCount());
      return instance;
    },
    [companionId, initialCompanion, hookCallbacks],
  );

  useEffect(() => {
    return () => {
      syncRef.current?.destroy();
      syncRef.current = null;
    };
  }, []);

  const forceSync = useCallback(async () => {
    await syncRef.current?.forceSync();
    if (syncRef.current) {
      setSyncState(syncRef.current.getSyncState());
      setPeerCount(syncRef.current.getPeerCount());
    }
  }, []);

  const getPendingOps = useCallback(
    () => syncRef.current?.getSyncState().pendingChanges ?? 0,
    [],
  );

  return {
    syncState,
    peerCount,
    ready,
    online: syncState ? syncState.status !== 'error' : false,
    createSync,
    forceSync,
    getPendingOps,
  };
}


// 설정 타입 재export
export type { P2PSyncConfig as P2PSyncConfigType };