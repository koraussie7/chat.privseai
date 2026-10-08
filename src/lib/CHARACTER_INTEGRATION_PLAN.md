# privseai.com × SillyTavern Integration Plan

## Goal
privseai.com을 Candy.ai와 동일한 기능을 가진 AI 컴패니언 서비스로 만들기.  
SillyTavern을 UI 엔진으로 활용하고, MuhanAI 백엔드에서 Personality Engine + Memory + Agent + MCP를 담당.

## Architecture

```
privseai.com (Frontend)
    ↓ (Trystero P2P + HTTPS API)
MuhanAI Companion Engine (Backend)
    ├── Personality Engine (character card → system prompt)
    ├── Memory System (long-term conversation memory via Colibri WASM)
    ├── Agent Router (intent classification → MCP tool routing)
    ├── MCP Router (tool discovery + execution)
    └── P2P Mesh (Trystero WebRTC signaling)
```

## Existing Codebase Mapping

| Component | Location | Status |
|-----------|----------|--------|
| Candy-style 3-panel Chat UI | `src/components/CompanionChat.tsx` | ✅ 완료 (Luna/Aria 컴패니언) |
| Chat route with auth/quota | `src/pages/ChatPage.tsx` | ✅ 완료 |
| Trystero P2P client | `src/lib/trystero-client.ts` (403 lines) | ✅ 완료 (P2PCLAW room, Colibri gateway, ping-pong) |
| Colibri WASM inference client | `src/lib/colibri-wasm-client.ts` (259 lines) | ✅ 완료 (generate, registerModel, listModels, getStatus, syncMemory) |
| P2P hooks | `src/hooks/useTrysteroP2P.ts` | ✅ 완료 (useTrystero, useColibri, useNetworkPoll) |
| Auth system | `src/lib/auth.ts`, `src/hooks/useAuth.ts` | ✅ 완료 |
| Character profiles | `src/components/CompanionChat.tsx` (BUILTIN) | ✅ Luna, Aria (name, age, bio, personality, stage) |
| Pythia Event types | `src/types/pythia.ts` | ✅ 완료 (PythiaEvent, Forecast, ImpactAnalysis, ColibriMetrics) |
| Navigation | `src/App.tsx` (7 routes) | ✅ 완료 |

## Phase 1: Character Card System (SillyTavern Compatibility)

### 1-1. Character Card Format
**목표**: SillyTavern `.character` 카드 JSON → privseai 컴패니언 프로필 변환

```typescript
// src/types/character.ts
export interface CharacterCard {
  spec: "chara_card_v2";
  data: {
    name: string;
    description: string;        // 배경 이야기
    personality: string;        // 성격 (SillyTavern "personality" 필드)
    scenario: string;           // 시나리오/관계 설정
    first_mes: string;         // 첫 인사
    mes_example: string;       // 대화 예시
    creator_notes: string;     // 창조자 메모
    system_prompt: string;     // 시스템 프롬프트 (옵션)
    post_scriptment: string;   // 부가 설명
    tags: string[];            // 태그 (예: "girlfriend", "tsundere")
    creator: string;
    character_version: string;
    src: string;               // 이미지 소스
    extensions: {
      scenario?: string;
      is_secret?: boolean;
      favorite?: boolean;
    };
  };
}
```

### 1-2. 파일 업로드 + 변환
**목표**: JSON/이미지 파일을 업로드 → CompanionProfile로 변환

파일: `src/lib/character-card.ts`
- `parseCharacterCard(file: File): Promise<CharacterCard>`
- `cardToProfile(card: CharacterCard): CompanionProfile`
- `profileToCard(profile: CompanionProfile): CharacterCard`

### 1-3. UI 통합
**목표**: CompanionChat.tsx에 캐릭터 카드 가져오기 버튼 추가

- `src/components/CharacterCardUploader.tsx` — 드래그 앤 드롭 파일 업로드
- `src/components/CharacterGallery.tsx` — 카드 갤러리 뷰 (grid of character cards)
- ChatPage.tsx: `BUILTIN` → `BUILTIN + userCards` (localStorage 저장)

## Phase 2: Long-Term Memory System

### 2-1. Memory 구조
**목표**: 대화 기록을 세그먼트 단위로 저장 + 컨텍스트 압축

```typescript
// src/types/memory.ts
export interface MemoryEntry {
  id: string;
  companionId: string;
  type: "fact" | "preference" | "relationship" | "experience";
  content: string;
  importance: number;         // 0-1
  created_at: number;
  last_accessed: number;
  expires_at?: number;        // optional expiry
}

export interface ConversationSummary {
  session_id: string;
  companion_id: string;
  summary: string;            // LLM 요약 결과
  key_points: string[];       // 핵심 포인트
  entities: string[];         // 언급된 엔터티
  timestamp: number;
  message_count: number;
}
```

### 2-2. P2P Memory Sync
**목표**: Trystero P2P를 통해 피어 간 메모리 동기화

`src/lib/trystero-client.ts`에 추가:
- `broadcastMemory(memory: MemoryEntry)` — `memory-sync` 액션
- `requestMemory(query: string)` — `memory-query` 액션 (request-response)

### 2-3. Context Window 관리
**목표**: 대화가 길어질 때 오래된 내용 요약

- `src/lib/memory-manager.ts`:
  - `summarizeSession(messages: UIMessage[]): Promise<ConversationSummary>`
  - `injectMemory(prompt: string, memories: MemoryEntry[]): string`

## Phase 3: Image Generation (ComfyUI Integration)

### 3-1. ComfyUI Bridge
**목표**: 로컬 ComfyUI + 클라우드 fallback

```typescript
// src/lib/image-service.ts
export class ImageService {
  private comfyUIUrl: string;    // http://localhost:7860 (local)
  private falAiKey?: string;      // cloud fallback

  async generateImage(prompt: string, options: ImageOptions): Promise<string> {
    // 1. Local ComfyUI 우선 시도
    // 2. P2P 피어에게 요청 (colibriPeers)
    // 3. Cloud (Fal.ai) fallback
  }
}
```

### 3-2. Avator/Selfie System
**목표**: 캐릭터의 현재 상태에 따른 이미지 생성

- `generateSelfie(companion: CompanionProfile, mood: string, context: string): Promise<string>`
- `companion.stage`에 따른 이미지 스타일 (친구 → 데이트 → 커플)

## Phase 4: Voice System (TTS/STT)

### 4-1. TTS (Speech Synthesis)
**목표**: 컴패니언의 대사를 음성으로 변환

```typescript
// src/lib/tts-service.ts
export class TTSService {
  private providers = ["web-speech", "edge-tts", "p2p-tts"];

  async speak(text: string, voice?: string): Promise<void> {
    // 1. Web Speech API (browser)
    // 2. Edge TTS (한국어/베트남어 지원)
    // 3. P2P relay (nearby peer with TTS)
  }
}
```

### 4-2. STT (Speech Recognition)
**목표**: 사용자 음성 → 텍스트

```typescript
// src/lib/stt-service.ts
export class STTService {
  async transcribe(audio: Blob, language: string): Promise<string> {
    // Web Speech API or cloud STT
  }
}
```

### 4-3. UI 통합
- CompanionChat.tsx 우측 패널에 "🎙️ Voice" 버튼 추가
- 마이크 녹음 → STT → 채팅 전송
- 챗봇 응답 → TTS → 재생

## Phase 5: Personality & Relationship Engine

### 5-1. 관계 단계 (Relationship Stage)
```typescript
export type RelationshipStage =
  | "stranger"   // 처음 만난 사람
  | "acquaintance" // 가벼운 친구
  | "friend"     // 친한 친구
  | "close"      // 아주 친한 친구
  | "partner"    // 애인 관계
  | "intimate";  // 가장 가까운 관계

export const STAGE_NAMES: Record<RelationshipStage, string> = {
  stranger: "낯선 사람",
  acquaintance: "지식",
  friend: "친구",
  close: "친한 친구",
  partner: "애인",
  intimate: "가장 가까운 사람",
};
```

### 5-2. 감정 모델
```typescript
export interface EmotionState {
  happiness: number;   // 0-1
  intimacy: number;    // 0-1
  trust: number;       // 0-1
  arousal: number;     // 0-1 (기분 전환)
  last_update: number;
}
```

### 5-3. Personality Engine
**목표**: 관계/감정에 따라 system prompt 동적 생성

```typescript
// src/lib/personality-engine.ts
export class PersonalityEngine {
  generateSystemPrompt(companion: CompanionProfile, emotion: EmotionState): string {
    return [
      `You are ${companion.name}.`,
      companion.personality?.join(" ") ?? "",
      `Your current mood: Happiness=${emotion.happiness.toFixed(1)}, Trust=${emotion.trust.toFixed(1)}`,
      companion.stage === "intimate" ? "Respond very intimately." : "",
    ].filter(Boolean).join("\n");
  }

  updateEmotion(event: "message" | "compliment" | "ignore" | "touch", current: EmotionState): EmotionState
}
```

## Phase 6: Candy.ai Feature Parity

| Candy.ai Feature | privseai Implementation | Status |
|-----------------|------------------------|--------|
| Character Cards | `src/lib/character-card.ts` | 🚧 |
| Roleplay mode | PersonalityEngine + RelationshipStage | 🚧 |
| Long-term memory | MemoryEntry + P2P sync | 🚧 |
| AI selfies | ImageService + stage-based prompts | 🚧 |
| Voice chat | TTSService + STTService | 🚧 |
| Photo sharing | Vision MCP + ImageService | ✅ (privseai-trystero has vision hooks) |
| AR filters | WebRTC + Colibri WASM overlay | 🔜 |
| Smart Glass integration | MuhanAI Wearable P2P packages | ✅ (separate repo) |

## Phase 7: API Extensions Needed

### /api/chat (existing, needs extension)
```typescript
// Current: { companionId, message, system, byok, colibri }
// Extend with:
{
  companionId: string;
  message: string;
  system: string;
  memory_context: ConversationSummary[];  // memory injection
  emotion_state: EmotionState;             // mood-aware response
  personality_prompt: string;              // dynamic system prompt
  generate_image: boolean;                 // selfie generation flag
  tts_enabled: boolean;                    // voice response flag
  stream: boolean;                         // streaming response
}
```

### New endpoints:
- `GET  /api/memory/:companionId` — Get all memories for a companion
- `POST /api/memory/:companionId` — Add/update memory
- `POST /api/image/generate` — Trigger selfie generation
- `POST /api/tts/speak` — Trigger TTS
- `POST /api/character/import` — Upload + parse character card
