# PromptLab 통합 작업 지시서 — PrivseAI World
> **대상:** Claude Code / AI coding agent가 `privseai-trystero`에 PromptLab 기능을 안전하게 통합할 때 사용한다.
>
> **외부 프로젝트:** [gracech0322-cmd/promptlab-image-video-to-prompt](https://github.com/gracech0322-cmd/promptlab-image-video-to-prompt)
>
> 이 문서는 통합 구현 지시서다. 아래 기능을 실제로 구현하기 전에는 PromptLab 원본 소스를 직접 확인하고, 현재 저장소 상태와 다른 부분을 찾아 업데이트한다. 이 문서만 보고 원본 동작을 추측해 복제하지 않는다.

---

## 1. 목표와 범위
PrivseAI의 이미지/영상 생성 흐름에 **참조 이미지·로컬 영상 분석 → 생성 프롬프트 → AIHub/ComfyUI 생성** 경로를 제공한다.

### 사용자 흐름
1. 사용자가 `CandyCollection` 또는 생성 UI에서 참조 이미지나 로컬 영상 파일을 선택한다.
2. 브라우저에서 영상의 프레임을 샘플링하거나 이미지 파일을 읽는다.
3. 사용자가 직접 제공한 Gemini API key로 Gemini에 분석 요청을 보낸다.
4. 결과를 `Final Result` 프롬프트로 보여주고 사용자가 편집·승인한다.
5. 승인된 프롬프트를 이미지/영상 생성 UI에 전달한다.
6. 생성된 `ImageAsset`/`VideoAsset`은 기존 AIHub 및 Collection 흐름으로 관리한다.

### 범위에 포함
- 로컬 이미지 → 이미지 생성용 prompt 분석
- 로컬 비디오 → 대표 프레임 샘플링 → video prompt 분석
- 짧은 아이디어 → image/video prompt enhancement
- 사용자 편집, 복사, 재시도, 오류/사용량 안내
- 선택적으로 최근 prompt 기록(기본 최대 20개, 로컬 브라우저 저장)
- 분석 결과를 기존 ComfyUI workflow의 prompt 입력으로 연결
### 범위에 포함하지 않음
- Instagram/TikTok/X/Facebook/YouTube 자동 영상 추출
- 로그인 세션, DRM, m3u8, paywall 또는 접근 제한 우회
- URL에서 임의로 영상을 다운로드하는 기능
- 사용자 동의 없이 원본 미디어를 서버에 업로드하거나 저장
- 원본 PromptLab 브랜드/로고를 허가 없이 제품 UI에 복사
- 실제 외부 서비스에 아직 지원되지 않는다고 명시한 기능을 지원한다고 표시
---

## 2. 외부 프로젝트에서 확인된 사실과 검증할 사항
PromptLab README에 따르면 해당 프로젝트는 **Chrome extension**, Vite + TypeScript 기반이며 다음을 제공한다:

- 로컬 비디오 → 주요 프레임 샘플링 후 prompt 생성
- 웹 이미지 context-menu / 로컬 이미지 → image prompt
- 짧은 아이디어 → Image Prompt / Seedance 2.0 스타일 Video Prompt 강화
- Fast / Standard / Detailed 영상 frame sampling
- 최근 기록 최대 20개
- Gemini API 사용. API key는 extension storage에 보관하며 이미지·프레임·prompt가 Gemini에 전달될 수 있음
- 외부 서비스 영상 추출, DRM, m3u8 지원 안 함
- MIT license (이름/브랜딩 자산은 MIT license 대상이 아님)

README는 동작의 개괄 정보이지 API 계약이 아니다. 실제 구현 전 원본 저장소를 checkout해 `src/`, `package.json`, manifest, Gemini 요청 코드, prompt template, frame extraction, 저장 로직을 읽는다. 코드가 README 설명과 다르면 코드와 최신 license를 기준으로 결정하고 이 문서를 업데이트한다.

---

## 3. PrivseAI 현재 코드에 연결할 위치
실제 파일은 구현 전에 다시 확인한다. 현재 저장소에서 확인된 주요 연결점:

- `src/lib/ai-hub.ts` — AI package, 이미지/영상 asset, 생성 workflow 관리
- `src/lib/comfyui-client.ts` — `ComfyUIClient`, `NSFW_WORKFLOW`, `VIDEO_WORKFLOW`
- `src/types/ai-package.ts` — `ImageAsset`, `VideoAsset`, `ComfyUIWorkflow` 등의 타입
- `src/components/CandyCollection.tsx` — Characters / Images / Videos / Styles 탭과 asset 표시
- `src/components/CandyDiscover.tsx` — Discover UI 및 공유 AIHub 사용
- `src/hooks/useAIHub.ts` — 공유 AIHub 인스턴스 구독 훅
- `src/lib/age-verification.ts` 및 기존 age-gate UI — 성인 콘텐츠 보호
- `src/lib/locales/*.json` — 다국어 메시지
### 권장 신규 파일
구현 전에 저장소에서 동일 역할의 기존 파일이 있는지 grep으로 확인한 뒤 중복 생성하지 않는다.

- `src/lib/prompt-analyzer.ts` — Gemini 호출, prompt template, 입력 검증
- `src/lib/video-frame-sampler.ts` — 로컬 파일에서 지정된 개수의 프레임 추출
- `src/types/promptlab.ts` — 분석 모드/결과/기록 타입 (기존 공통 타입에 포함할 수 있으면 그쪽 사용)
- `src/components/PromptLabPanel.tsx` — 이미지/비디오/아이디어 입력, 설정, 결과 편집 UI
- `src/tests/prompt-analyzer.test.ts`
- `src/tests/video-frame-sampler.test.ts`
- `src/tests/promptlab-panel.test.tsx` (필요 시)

`PromptLab`이라는 명칭/브랜딩은 기능 설명용으로만 쓰고, 원 프로젝트 브랜드처럼 보이게 하지 않는다. UI에는 예를 들어 **Reference-to-Prompt** 또는 **Prompt Studio**를 사용한다.

---

## 4. 구현 전 필수 탐색
1. 저장소 상태:
   ```bash
   git status --short
   git log --oneline -5
   ```
   기존 사용자 변경은 보존한다. 관련 없는 변경을 reset/checkout하지 않는다.
2. PromptLab 원본을 임시 디렉토리에 clone하고 다음을 확인한다:
   - `LICENSE`
   - `package.json`, Chrome manifest
   - `src/` 내 Gemini request, prompt template, video sampling, persistence 구현
   - API key 저장 및 오류/usage 처리를 확인
3. PrivseAI 쪽 기존 구현 확인:
   - Gemini/AI provider 호출 코드나 API key 설정 화면이 이미 있는지 검색
   - ComfyUI 이미지 및 영상 생성 호출의 실제 시그니처 확인
   - `CandyCollection` 탭/모달 구조와 `useAIHub()` 반환 타입 확인
   - `package.json` scripts 및 `vitest.config.ts` 확인
4. 원본 PromptLab의 browser extension 의존성을 import하지 않는다. 필요한 로직만 독립 모듈로 이식하고 extension API (`chrome.*`, side panel, context menu)에 대한 결합을 제거한다.

---

## 5. 권장 아키텍처
```text
Reference image / local video / text idea
                  │
                  ▼
      PromptLabPanel (UI + explicit user action)
                  │
     ┌────────────┴─────────────┐
     ▼                          ▼
video-frame-sampler       prompt-analyzer
(browser-only)            (Gemini BYOK)
     └────────────┬─────────────┘
                  ▼
    Editable Final Result prompt
                  │ user confirms
                  ▼
      Existing ComfyUI workflow
                  │
                  ▼
    AIHub ImageAsset / VideoAsset
                  │
                  ▼
     CandyCollection / existing P2P
```

### 경계와 책임
- Frame sampler는 로컬 파일을 브라우저 메모리에서 읽고, 필요한 key frames만 분석용으로 변환한다. 원본 파일을 서버로 전송하지 않는다.
- `prompt-an.ts`는 API key를 인자로 받거나 명시적 설정 adapter에서 가져온다. key를 소스 코드, URL, 로그, P2P payload에 쓰지 않는다.
- Prompt analyzer는 분석 결과를 생성 workflow에 자동 실행하지 않는다. 사용자가 결과를 보고 **Generate**를 명시적으로 눌러야 한다.
- ComfyUI client의 API를 재사용한다. `VIDEO_WORKFLOW`가 실제 영상 모델/노드를 지원하는지 확인하고, 단순히 prompt를 넣는다고 영상 생성이 되는 것으로 간주하지 않는다.
- 생성된 media는 기존 AIHub asset 메서드에 전달하며 stock/reference 원본 이미지와 생성 산출물을 출처 metadata로 구분한다.

---

## 6. 요구사항 — Prompt Analyzer
### 입력 모드
- `image`: 이미지 1개 (MVP); batch는 후속 범위
- `video`: 로컬 비디오, frame sampling mode 선택
- `enhance-image`: 텍스트 아이디어를 이미지 prompt로 확장
- `enhance-video`: 텍스트 아이디어를 video prompt로 확장
### 결과 계약
최소 타입 예시 (기존 타입과 충돌하면 기존 타입을 확장):

```ts
export type PromptMode = "image" | "video" | "enhance-image" | "enhance-video";

export interface PromptAnalysisResult {
  prompt: string;                 // Final Result, 편집 가능
  mode: PromptMode;
  model: string;
  createdAt: number;
  sourceFileName?: string;        // 로컬에서만 보관; P2P 기본 제외
  frameCount?: number;
  usage?: { inputTokens?: number; outputTokens?: number };
}
```

- 원본 PromptLab 템플릿을 이식할 때 저작권/라이선스 조건과 모델별 출력 기대를 확인한다.
- Video prompt에는 subject, action, camera language, motion continuity, pacing, scene structure를 구조적으로 유도한다.
- Image prompt에는 subject, scene, composition, style, lighting, palette, mood, texture/material, perspective를 다룬다.
- 응답을 검증하고 빈 응답/잘못된 JSON/모델 오류를 사용자에게 이해 가능한 오류로 바꾼다.
- Prompt length, 파일 크기, frame count, timeout에 합리적인 한도를 둔다.
- 사용자 텍스트를 HTML로 직접 렌더링하지 않는다. 결과는 일반 text로 표시한다.

---

## 7. BYOK 및 개인정보 요구사항
1. Gemini API key는 **사용자의 브라우저 로컬 저장소**에만 보관한다. 기존 앱의 key가 있으면 재사용하고, 없다면 `localStorage`/IndexedDB 또는 이미 쓰는 안전한 저장 계층을 선택한다.
2. 서버 환경변수에 사용자 Gemini key를 저장하지 않는다. Analytics, error reporting, console log에 key를 포함하지 않는다.
3. API 호출 전에 사용자에게 명확히 안내한다: 선택한 이미지/비디오 프레임/텍스트가 Google Gemini에 전송된다.
4. 영상 파일 전체 업로드 대신 기본은 선택된 프레임만 전송한다. Google Gemini의 현재 API 제한과 가격은 공식 문서에서 확인하고 문서/설정 UI에 최신 출처 링크를 둔다.
5. 기록 기능은 opt-in 또는 명확한 설정과 삭제 동작을 제공한다. 기록 기본 최대 20개. 기록 안에 원본 파일 bytes나 API key를 저장하지 않는다.
6. 다른 사용자가 볼 수 있는 AIHub/P2P package에 API key, source file path, 원본 frame bytes를 절대로 포함하지 않는다.
7. 취소 시 AbortController 또는 provider가 제공하는 취소 방식을 사용하고, object URL / video element / canvas / bitmap 리소스를 해제한다.

---

## 8. Video Frame Sampling
PromptLab README의 기본 reference:

- Fast: 5 frames (0%, 25%, 50%, 75%, 95%)
- Standard: 최대 6–16 frames (길이 구간별)
- Detailed: 최대 10–32 frames (길이 구간별)
- 끝 프레임 100%는 seek 오류/검은 프레임 위험을 줄이기 위해 피함
다만 이 개수는 그대로 복사하지 말고 Gemini API의 이미지 입력 제한/비용, 브라우저 메모리, 업로드 payload 크기를 고려해 실제 구현에서 cap을 정한다.

### 필수 처리
- 허용 파일 타입 및 최대 duration/file size 검증
- `video` metadata 로드 timeout, seek timeout, `loadeddata`/`seeked` 오류 처리
- 0–95% 범위에서 중복되지 않는 timestamp 선택
- 프레임 크기를 provider payload 한도에 맞춰 downscale
- 캔버스에서 이미지 추출 오류 및 CORS/codec 미지원 안내
- analysis 완료/오류/취소 후 object URL revoke, video src 제거, canvas/bitmap 리소스 해제
- 검은 프레임, 프레임 0개, duration 0, 손상된 파일을 테스트
### 제한
외부 사이트에서 자동 다운로드/영상 추출 기능은 추가하지 않는다. 사용자가 본인이 가진 파일을 직접 선택하는 local-only 흐름만 허용한다.

---

## 9. UI/UX 요구사항
- `CandyCollection`의 Images 또는 Videos 탭에서 접근 가능한 `Prompt Studio` 패널/모달로 구현한다. 현재 컴포넌트가 이미 커졌다면 별도 컴포넌트로 분리한다.
- 입력 방식: Image / Local video / Text idea 탭
- Sampling mode는 video에만 노출, 기본 Standard
- 선택 파일명, 용량, 영상 길이/프레임 수 표시
- 분석 중 progress/취소 제공
- `Final Result` 텍스트 편집 영역과 Copy 버튼 제공
- Generate 버튼은 prompt 결과 확인 뒤 명시적으로 누르게 한다.
- prompt를 `ComfyUIWorkflow`에 적용할 때 현재 workflow 입력 키를 실제로 확인한다. 실패하면 prompt를 클립보드로 복사할 fallback 제공.
- Gemini key 미설정 시 Settings로 이동하는 CTA와 key 저장 안내 제공.
- NSFW 파일의 분석/생성은 기존 연령 확인 정책을 따른다. 분석기 추가가 age gate를 우회하지 않도록 한다.
- 접근성: label, keyboard navigation, focus management, modal Escape, button `type="button"` 준수.
- 새 UI 문자열은 기존 i18n JSON에 반영한다. 지원 언어 수에 맞춰 번역하고, 누락 key fallback 동작을 확인한다.

---

## 10. 생성 파이프라인 연동
### 이미지
1. 분석 prompt를 사용자 편집 가능하게 한다.
2. 생성 호출은 기존 `AI`/`ComfyUIClient` 경로를 사용한다.
3. 반환된 이미지가 기존 `ImageAsset` metadata/persistence 모델을 따르는지 확인한다.
4. Reference 이미지 URL 또는 파일명은 명시적으로 허용하지 않는 한 P2P package에 포함하지 않는다.

### 비디오
1. 현재 `VIDEO_WORKFLOW`가 실제로 어떤 node/input을 요구하는지 확인한다 (`src/lib/comfyui-client.ts`).
2. Seedance 2.0-style prompt는 prompt formatting convention이지, ComfyUI에 Seedance model이 있다는 보장이 아니다.
3. 사용 가능한 workflow/model이 없으면 video prompt 생성까지만 제공하고, 비디오 생성 기능이 되는 것처럼 표시하지 않는다.
4. Video output metadata(길이, fps, model, workflowId 등)를 기존 `VideoAsset` 타입에 맞춰 저장한다.

### P2P / sharing
- 이미지/영상 자체 또는 reference 파일 bytes를 P2P로 자동 broadcast하지 않는다.
- Prompt 공유는 사용자 별도 opt-in이 있을 때만 고려하고, 패키지 schema versioning/정리/민감정보 검사를 추가한다.
- API key, 로컬 파일 경로, private prompt history는 공유 불가.

---

## 11. 라이선스 및 브랜드 준수
- 원본 저장소 MIT license 전문을 확인하고, 코드 이식 시 저작권/라이선스 고지를 보존한다.
- 원본의 이름/로고/브랜딩 자산은 MIT 라이선스에 포함되지 않는다고 README가 밝히므로 사용하지 않는다.
- Google Gemini API의 현재 이용약관, 데이터 처리 정책, rate limit을 공식 문서에서 확인하고 링크를 남긴다.
- 이 기능은 콘텐츠 권리 확인을 대신하지 않는다. 사용자가 허가받은 이미지/영상만 분석하도록 UI에서 안내한다.

---

## 12. 구현 단계
### Phase 0 — Audit
- 원본 PromptLab 저장소 직접 검사, license 및 API 흐름 확인
- PrivseAI의 Gemini/BYOK/settings, ComfyUI, i18n, age-gate, AIHub 구현 확인
- 구현 범위와 API 비용/데이터 전송 경계 문서화
### Phase 1 — Prompt analysis MVP
- `prompt-analyzer.ts`와 BYOK 연결
- text idea → image/video prompt
- local image → image prompt
- 편집 가능한 Final Result + copy
- 단위 테스트 및 Settings/key 안내
### Phase 2 — Local video analysis
- browser-side video sampler
- Fast/Standard/Detailed mode (provider limits에 맞춰 cap)
- 오류/취소/리소스 해제 테스트
- 프레임만 Gemini로 전송, 원본 영상 서버 미저장
### Phase 3 — Generate handoff
- 승인 prompt → ComfyUI image workflow
- VIDEO_WORKFLOW 실제 지원 확인 후에만 video generation 연결
- AIHub assets 및 Collection 표시
### Phase 4 — History / package integration (optional)

- opt-in local history, 최대 20건, delete/clear
- Prompt를 package와 공유할 때 명시적 선택 및 schema version
- P2P 보안/라이선스 review
각 Phase는 독립적으로 TypeScript, 테스트, 빌드 검증이 완료된 후 다음 Phase로 간다. Phase 2/3이 어려우면 Phase 1을 축소하지 않고 정확한 제한을 표시한다.

---

## 13. 검증 및 완료 조건
필수 실행 (저장소 scripts를 먼저 확인):

```bash
npx tsc --noEmit
npx vitest run
npm run build
```

필수 테스트 항목:

- prompt mode별 request payload와 템플릿
- Gemini 성공/빈 결과/HTTP 오류/429/timeout/cancel
- key가 URL, log, stored history, AIHub package에 새지 않는지
- 비디오 frame timestamp 및 Fast/Standard/Detailed cap
- metadata/seek/canvas error 및 resource cleanup
- prompt → existing workflow 연결 및 workflow 미지원 fallback
- age gate와 NSFW 표시가 기존 정책을 유지하는지
- keyboard/accessibility 및 i18n 주요 문자열
**완료 선언 기준:**

- TypeScript 오류 0
- 전체 Vitest suite 통과
- production build 성공
- 실제 API key 없이는 네트워크 호출 없는 mock tests
- 개인정보 안내가 UI에서 호출 전에 보임
- `CLAUDE.md` 및 본 문서의 관련 상태 업데이트
- 변경 목록/제약/미구현 단계를 최종 요약
---

## 14. 에이전트 작업 규칙
- 먼저 현재 repo의 git status를 확인하고 기존 사용자 변경을 보존한다.
- 편집할 기존 파일은 먼저 읽고, 필요한 곳만 작은 diff로 수정한다.
- 큰 rewrite보다 별도 module/component를 추가한다.
- API 호출을 구현했다고 외부 provider에서 성공을 검증했다고 주장하지 않는다. Mock tests와 real API smoke test 결과를 구분한다.
- 배포는 별도 명시적 요청이 없으면 하지 않는다. 배포 전 backup, 실제 target 확인, health check가 필요하다.
- 실데이터/사용자 미디어 없이 테스트 가능하도록 provider를 mockable하게 설계한다.
- PromptLab 원본을 통째로 vendoring하거나 extension 전체를 PrivseAI 앱에 넣지 않는다. 필요한 동작만 라이선스 준수 아래 browser-native 모듈로 통합한다.

---

## 15. 참고 링크
- PromptLab repository: https://github.com/gracech0322-cmd/promptlab-image-video-to-prompt
- PromptLab MIT license: https://github.com/gracech0322-cmd/promptlab-image-video-to-prompt/blob/main/LICENSE
- PromptLab README: https://github.com/gracech0322-cmd/promptlab-image-video-to-prompt/blob/main/README.md
- Google AI Studio: https://aistudio.google.com/
- Gemini API documentation: https://ai.google.dev/gemini-api/docs
---

**문서 상태:** 통합 구현 작업 지시서 (미구현 기능에 대한 계획 문서)
**작성일:** 2026-10-10


---

# 16. 실제 구현 코딩 플랜 (Claude Code 실행 체크리스트)

> 이 섹션은 기능 개발을 실제 수행하기 위한 순서·변경 파일·테스트 계약이다.
> 구현 에이전트는 각 단계 완료 후 체크박스/상태를 갱신하고, 실패 시 다음 단계로 넘어가지 않는다.
> 기존 작업 트리에 미커밋 변경이 있을 수 있으므로 시작 전에 반드시 `git status --short`를 보고 보존한다.

## 16.1 MVP 확정 범위
**MVP 목표:** 사용자가 소유한 로컬 이미지 또는 텍스트 아이디어를 Gemini로 분석/확장하고, 편집 가능한 prompt를 복사하거나 기존 ComfyUI 이미지 생성으로 넘긴다.

MVP 순서는 다음과 같다:
1. Text idea → Image prompt (API key/config 및 Gemini 오류 처리를 가장 먼저 검증)
2. Local image → Image prompt (이미지 전송·개인정보 안내)
3. Prompt 편집/복사 및 AIHub/ComfyUI 이미지 workflow handoff
4. Local video frame sampling 및 video prompt 분석은 Phase 2로 분리
5. Video generation, prompt history, P2P prompt 공유는 MVP 범위 밖
**기술 전제:** 현재 저장소에는 `src/lib/comfyui-client.ts`의 `VIDEO_WORKFLOW` 상수가 있으나, 현행 `AIHub` API에 명확한 video submit/wait 경로는 확인되지 않았다. 해당 workflow는 `VHS_VideoCombine` node를 포함한다는 사실만으로 video generation 지원을 보장하지 않는다. Phase 2/3 audit에서 ComfyUI server node availability, workflow schema, 결과 저장/서빙을 실제 검증하기 전에는 비디오 생성 버튼을 구현하지 않는다.

## 16.2 Phase별 변경 파일과 실행 계획
### Phase 0 — Read-only audit / 설계 동결
- [ ] 현재 repo root 확인 및 `git status --short`, `git log -5` 저장. 관련 없는 미커밋 파일을 reset/checkout하지 않는다.
- [ ] PromptLab HEAD/commit, LICENSE, manifest, Gemini request, prompt templates, frame sampling/history 코드를 직접 확인하고 필요한 동작만 목록화한다.
- [ ] `package.json`, `vitest.config.ts`, `src/lib/config.ts`, `src/lib/multi-model-client.ts`, Settings UI, `ai-hub.ts`, `comfyui-client.ts`, `CandyCollection.tsx`, i18n JSON을 확인한다.
- [ ] 기존 Gemini client/key 설정이 있으면 재사용 여부 결정. key가 이미 backend-proxy 방식이면 아키텍처를 유지하고 브라우저 직통 호출을 중복 추가하지 않는다.
- [ ] 현재 `ComfyUIWorkflow` 타입과 `createWorkflow`/`generateImage` 호출 흐름, NSFW gate, 이미지 결과 persistence를 기록한다.
- [ ] Audit 결과를 이 문서의 구현 전제와 다르면 문서 업데이트 후에만 코딩을 시작한다.

**산출물:** 변경 없음; 확인한 API/key 경계와 실제 prompt provider 모델 ID를 PR/작업 요약에 기록.

### Phase 1 — Text-to-prompt service 및 BYOK 연결
**예상 파일**
- 신규 `src/lib/prompt-analyzer.ts`
- 신규 또는 기존 설정 UI 파일 (audit 결과에 따라 선택)
- 설정 저장 위치가 기존 config라면 해당 타입/storage만 최소 확장
- 신규 `src/tests/prompt-analyzer.test.ts`

**구현 순서**
1. Prompt mode와 입력 결과 타입 정의. MVP에서는 `enhance-image`와 `image`만 구현하고 미구현 비디오 mode를 UI/API에서 노출하지 않는다.
2. Gemini model ID와 endpoint/version은 현재 공식 Gemini API 문서 및 원본 PromptLab 실제 코드로 검증한다. README 예시만 복사하지 않는다.
3. 기존 provider abstraction이 충분하면 adapter로 연결한다. 없으면 `PromptAnalyzer`에 `fetch`를 주입할 수 있게 만들어 테스트 가능하게 한다.
4. API key 입력/수정/삭제 및 저장 표시. 저장 위치는 Phase 0에서 정한 기존 앱 설정 adapter를 쓰며, 브라우저 key를 URL query parameter, analytics, logs, P2P, package metadata에 넣지 않는다.
5. Request payload에서 prompt/template과 입력을 분리하고, 응답 status/schema/content를 검증한다. 모델 오류, 401/403, 429, timeout, 빈 응답을 사용자용 오류 코드로 변환한다.
6. AbortSignal을 받아 취소 시 요청을 abort한다. 입력 길이/요청 크기 상한을 둔다.
7. 오류 로그는 status/code만 기록하고 key, image bytes, 전체 사용자 prompt를 기록하지 않는다.

**테스트 계약**
- `fetch` mock으로 정상 text output, 빈 output, invalid JSON, API error, 401, 429, timeout, abort를 검증한다.
- 요청 URL에 key가 query string으로 나타나지 않고, error object/log에 key가 포함되지 않음을 검증한다.
- 실제 Gemini 호출은 일반 CI에서 하지 않는다. Real API smoke test는 사용자 key가 있고 사용자가 명시한 경우에만 별도 기록한다.

**완료 게이트:** `npx vitest run src/tests/prompt-analyzer.test.ts`, `npx tsc --noEmit` 통과.

### Phase 2 — Image-to-prompt / Text Enhance UI
**예상 파일**
- 신규 `src/components/PromptStudio.tsx` (PromptLab 브랜드를 쓰지 않음)
- `CandyCollection.tsx`에서 Images 탭에 진입 버튼 또는 기존 modal/panel을 연결
- 기존 `src/lib/i18n.ts` 및 `src/lib/locales/*.json` 메시지 키 추가
- 신규 `src/tests/PromptStudio.test.tsx` (프로젝트 테스트 환경에 React Testing Library가 구성된 경우)

**구현 순서**
1. UI mode: `Text idea` / `Image` 두 모드만 구현한다.
2. Image input: file picker 및 drag/drop은 선택사항. MIME `image/jpeg`, `image/png`, `image/webp` 등 Gemini가 실제 지원하는 형식만 허용하고, size/dimension limits를 표시한다.
3. 분석 호출 전에 Google Gemini로 선택한 텍스트/이미지가 전송됨을 명시적으로 알리고 사용자가 Analyze를 눌러야 전송한다.
4. API key 미설정일 때 input을 전송하지 않고 Settings 진입 CTA를 보인다.
5. 결과는 `Final Result` editor textarea로 표시하고 편집/Copy/Analyze again을 제공한다.
6. 상태(ready/loading/cancelled/error/success), progress, error를 접근성 상태 영역으로 표시한다. 파일 선택 취소 후 기존 결과를 조용히 유지하거나 초기화 정책을 일관되게 적용한다.
7. UI 문자열은 지원 locales 전체에 key를 추가하고 빠진 번역 key를 검증한다.
8. 기존 NSFW content age gate를 우회하지 않는다. MVP에서는 분석기에 별도 NSFW detection을 추가했다고 주장하지 않는다.

**완료 게이트:** 수동 UI 확인 + `npx tsc --noEmit` + `npx vitest run`.

### Phase 3 — Editable prompt → ComfyUI image generation handoff
**예상 파일**
- PromptStudio generate handoff 및 최소 `CandyCollection.tsx` 연결
- workflow helper가 필요할 경우 `src/lib/comfyui-client.ts` 또는 `ai-hub.ts`에 단위 테스트 가능한 helper
- 신규 `src/tests/prompt-workflow.test.ts` 또는 기존 ComfyUI test에 케이스 추가
**구현 순서**
1. 실제 image workflow prompt node mapping을 확인한다. workflow node ID를 UI에 하드코딩하지 말고 기존 workflow builder나 명시적인 tested helper를 사용한다.
2. prompt를 사용자 확인/편집 뒤에만 workflow에 넣는다. Gemini 응답을 자동 실행하지 않는다.
3. 기존 AIHub `generateImage(pkgId, workflow)` → `waitForImage(jobId, pkgId)` 경로를 재사용한다.
4. package 선택이 필요한 흐름이면 UI에서 대상 companion/package를 명시한다. implicit/default package에 넣지 않는다.
5. 기존 ComfyUI offline/workflow missing/error 상태와 output persistence 동작을 재사용한다.
6. source reference file 및 image bytes를 AIHub package에 자동으로 첨부하지 않는다. 새 generated asset만 기존 API로 등록한다.
7. ComfyUI workflow 미지원/오프라인이면 prompt copy fallback을 제공한다.

**완료 게이트:** mock ComfyUI 테스트로 올바른 workflow prompt 전달, job 완료 시 AIHub 등록, failure/offline/cancel 상태 확인; full build 통과.

### Phase 4 — Local video analysis (별도 릴리스 가능)

**예상 파일**
- 신규 `src/lib/video-frame-sampler.ts`
- `PromptStudio.tsx`에 Local video mode 및 Fast/Standard/Detailed controls
- 신규 `src/tests/video-frame-sampler.test.ts`
- `src/tests/prompt-analyzer.test.ts`에 multi-image/frame payload 케이스
**구현 순서**
1. PromptLab 실제 sampling implementation을 참고하되 provider limit, browser memory, payload size에 맞춰 frame count와 dimensions를 다시 정한다.
2. local-only file selection. URL 입력 및 사이트 download/extraction은 구현하지 않는다.
3. video metadata를 읽고 0–95% 구간에서 고유 timestamp를 계산한다. duration/file size/type limits 적용.
4. seek/load timeout, unsupported codec, black frame, canvas failure를 처리한다.
5. frame extraction 이후 크기를 줄여 Gemini request에 이미지 part로 전달한다. 원본 video bytes는 서버로 전송하지 않는다.
6. 취소/완료/오류 모든 경로에서 object URL revoke, video element source 정리, canvas/bitmap 해제를 확인한다.
7. UI에서 선택 프레임 개수 및 Google로 전송할 데이터 범위를 표시한다.
8. 결과를 video prompt로 분류해 편집/복사까지만 제공한다. 현행 backend가 검증되기 전에는 “Generate video”를 표시하지 않는다.

**테스트 계약**
- timestamp calculation: duration 0, 짧은 영상, 10/30/60 초 경계, >60초, sampling modes, 중복/마지막 프레임 제외
- Browser media APIs mock: metadata/seek success, timeout, error, no frame, canvas exception, cancel cleanup
- payload max frame count / image downscale 확인
### Phase 5 — Video generation / history / P2P는 별도 승인
- Video generation: ComfyUI server에 실제 video node/model이 있는지, workflow JSON accepted/valid output persisted/served 하는지 확인한 뒤 별도 계획과 integration test를 먼저 작성한다.
- Prompt history: Phase 1–4 안정화 후 opt-in local-only history로 별도 진행. 최대 20건, clear/delete, image/video bytes와 API key 미저장.
- P2P prompt share: 기본 비활성. schema version, explicit opt-in, privacy review, length/secret scrub test를 설계하고 사용자 승인 후 구현한다.

## 16.3 데이터 계약 제안
MVP output은 다음과 같은 **local UI state**로 유지한다. 이 타입을 package/P2P schema에 자동 추가하지 않는다.

```ts
export type PromptStudioMode = "text-to-image" | "image-to-prompt";

export interface PromptStudioResult {
  id: string;
  mode: PromptStudioMode;
  prompt: string;
  model: string;
  createdAt: number;
  sourceFileName?: string; // local UI display only; do not serialize/share
}
```

- prompt text는 편집 가능하므로 server/ComfyUI로 보내는 값은 항상 사용자가 승인한 최신 editor 값이어야 한다.
- Gemini key는 결과 객체, local history, AIHub package, error payload에 넣지 않는다.
- Phase 4가 승인될 때 video mode를 type contract에 추가하고 별도 검증한다.

## 16.4 환경설정/비용 UX
- API key 미설정, invalid key, quota/rate limit을 구별해 안내한다.
- 각 분석 action 전에 “외부 Gemini API 호출이며 사용량/비용이 발생할 수 있음” 안내를 UI에서 항상 접근 가능하게 한다. 실제 요금/free quota는 하드코딩하지 말고 공식 문서 링크를 제공한다.
- `model`, max output tokens, timeout은 config로 관리하되 안전한 기본값을 둔다. provider가 허용하지 않는 설정을 무시하지 말고 검증한다.
- 모바일 브라우저에서 큰 이미지/video frame을 다룰 수 있도록 파일 크기, 이미지 해상도, frame 수 cap을 지킨다.

## 16.5 실행 체크리스트 (복사용)

```text
[ ] Phase 0 audit 및 dirty tree 확인 완료
[ ] PromptLab 원본의 source/license/API/frame sampler 직접 확인
[ ] 기존 Gemini/key/provider path 재사용 여부 결정
[ ] Phase 1: text-to-image analyzer + mock tests
[ ] Phase 2: local image UI + disclosure + i18n
[ ] Phase 3: ComfyUI image workflow handoff + AIHub result registration
[ ] Phase 4: local video sampler + cleanup/resource tests (별도 범위)
[ ] Gemini real API smoke test 여부/조건 결과에 명시
[ ] npx tsc --noEmit 통과
[ ] npx vitest run 전체 통과
[ ] npm run build 통과
[ ] diff 확인: key, file bytes, history, P2P에 민감 데이터 없음
[ ] 배포는 별도 승인 전 실행하지 않음
[ ] 이 문서의 phase 상태 및 미구현 제한 업데이트
```

## 16.6 실제 구현 우선순위 및 완료 선언
MVP 구현 우선순위는 **Phase 0 → Phase 1 → Phase 2 → Phase 3**이다. Phase 4는 별도 PR/승인으로 분리할 수 있다. Phase 5는 MVP 완료로 간주하지 않는다.

완료 메시지에는 다음을 명확히 구분한다:
- 구현한 모드 (text/image/video)
- 실행한 테스트 명령과 실제 통과 수
- mock test와 real Gemini API test 구분
- ComfyUI image/video handoff 검증 범위
- 배포 여부 (배포 전이면 로컬 코드만 완료라고 표기)
- 남은 제한과 key/data privacy 동작



**PromptLab MVP implementation status (2026-10-10):** Added image-to-prompt and text-idea expansion UI plus prompt analyzer tests. Per user clarification, Gemini key is configured on the server; the browser must call a PrivseAI proxy and must never receive the provider key. The deployed LiteLLM/KeiRouter API has no verified `/v1/prompt/analyze` route, so server-proxy analysis is not end-to-end working until that route is implemented and deployed. A local ComfyUI image handoff is being prototyped with existing `AIHub`/`ComfyUIClient`, but browser CORS/PNA, installed model/workflow availability and actual generation remain unverified. Video analysis/generation are not implemented. Current full TypeScript/build checks are blocked by malformed unrelated untracked Nexus code (`src/lib/nexus-client.ts`).

---

# 17. 사용자 PC 리소스 / BYOK 이미지·비디오 생성 구현 계획
> **목표:** `privseai.com`을 생성 UI와 설정/오케스트레이션 계층으로 제공하고, 실제 추론은 (1) 사용자의 로컬 ComfyUI 또는 (2) 사용자가 등록한 BYOK 이미지 provider에서 수행한다. PromptLab은 입력 분석 및 프롬프트 작성 단계로만 사용한다. PromptLab 자체가 생성 provider라는 전제를 두지 않는다.
>
> 이 절은 설계 계획이다. 구현 전에 실제 API provider 계약과 모델 가용성을 점검하고, provider 문서의 날짜/버전을 기록한다. 로컬 ComfyUI나 BYOK provider가 현재 서버에서 작동한다고 가정하지 않는다.

## 17.1 지원할 provider와 구분
### MVP 후보 A — 사용자 로컬 ComfyUI (이미지)
- 브라우저 앱이 사용자가 입력한 ComfyUI URL로 연결한다 (기본 `http://127.0.0.1:8188`).
- ComfyUI 설치, checkpoint/model, GPU/VRAM은 사용자가 제공·관리한다. 앱은 remote compute 비용을 부담하지 않는다.
- 기존 `src/lib/comfyui-client.ts`는 `/prompt`, history, `/view` 방식의 ComfyUI 클라이언트를 포함하며, AIHub에는 `generateImage`, `waitForImage`, `addImageAsset` 경로가 있다. 따라서 새로운 이미지 backend를 처음부터 만들지 말고 이를 provider adapter로 재사용한다.
- HTTPS 사이트에서 `http://localhost` 접근은 브라우저 mixed-content/CORS/private-network 정책에 걸릴 수 있다. 지원 브라우저에서 실험하고, ComfyUI CORS 설정/localhost-secure-context 동작/extension relay 중 실제 배포 가능한 연결 방식을 먼저 입증한다. 보안 제한을 우회하는 브라우저 플래그 변경을 사용자에게 요구하지 않는다.
- ComfyUI access password/token 지원이 사용 버전에서 확인되지 않으면 외부 네트워크에 노출하는 사용을 금지하고, localhost/private tunnel만 허용하도록 UI에 경고한다.

### MVP 후보 B — BYOK hosted image generation API
- `VITE_*` build-time env에 개인 key를 넣지 않는다. 사용자가 settings에서 직접 등록한다.
- MVP는 provider adapter를 하나만 먼저 구현한다. 선정 기준: 공식 image-generation endpoint, 브라우저에서 key-auth 가능 여부, CORS, 개인정보 정책, 출력 URL/base64 반환, rate limit, 이용약관, 유료/무료 quota 표시.
- Provider API가 브라우저 CORS를 지원하지 않거나 key를 브라우저에 노출하면 안 되는 경우, 직접 호출을 억지로 하지 않는다. 별도 proxy는 key를 서버에 보관·과금·운영하는 구조이므로, 본 “사용자 BYOK” 약속과 모순되지 않도록 별도 opt-in 설계/보안 검토를 거친다.
- BYOK는 **비용 무료 보장**이 아니다. provider가 무료 tier를 제공할 때만 현재 quota/모델/지역 제한/결제정보 필요 여부를 설정 화면에서 공식 출처와 함께 표시한다. quota가 바뀔 수 있으므로 “무료 무제한” 문구는 쓰지 않는다.
- “일반 Gemini key가 있다”는 이유만으로 이미지 생성 가능하다고 표시하지 않는다. 선정 provider/model의 공식 endpoint에서 image generation을 실제 확인한다.

### Local browser model (후속 조사)
- 현재 확인된 `WebLLMClient`는 브라우저 text LLM 경로다. 이미지/video diffusion을 이미 지원한다고 가정하면 안 된다.
- WebGPU diffusion/in-browser video는 모델 크기, VRAM, browser support, 다운로드 비용/용량, 성능을 별도 benchmark한 다음에만 추가한다. MVP에 포함하지 않는다.

## 17.2 사용자 기능 요구사항
- Settings/Creation panel에서 provider를 **Local ComfyUI / BYOK provider** 중 선택 가능.
- 선택 상태는 local browser profile에 저장한다. key 값은 화면에 재노출하지 않고, key 변경/삭제 버튼을 제공한다.
- provider마다 별도 “Test connection” 또는 validation action 제공. 테스트 요청으로 유료 생성이 발생하지 않도록 cheap status/capability endpoint만 사용한다.
- 생성 전에 예상 provider, 모델, 비용/무료 quota 고지, 입력 프롬프트를 보여주고 사용자가 명시적으로 Generate를 누른다.
- generation state: idle, validating, submitting, running, completed, failed, cancelled. 취소 불가 provider에는 취소 불가임을 표시한다.
- output이 실제 완료되기 전 성공 toast를 띄우지 않는다. 오류에서는 HTTP status, provider error code를 safe하게 표시하되 key/전체 headers를 숨긴다.
- 사용자는 출력 이미지를 미리보고 AIHub package에 저장/선택 취소할 수 있다. 자동으로 P2P에 공유하지 않는다.
- video generation은 provider가 실제 지원하고 API contract/비용/비동기 polling이 테스트된 경우에만 활성화한다. MVP UI에서는 provider capability에서 video=false면 숨기거나 disabled 상태+사유를 표시한다.

## 17.3 제안 아키텍처와 책임 분리
```text
PromptLab (reference -> editable prompt)  [optional input adapter]
                    │ user-approved prompt
                    ▼
       GenerationProviderRegistry
          ├─ ComfyUILocalProvider (existing client/AIHub)
          └─ HostedImageProvider (one audited BYOK provider)
                    │ provider job / output
                    ▼
          GeneratedMediaResult
                    │ user saves explicitly
                    ▼
        AIHub ImageAsset / Collection
```

- 신규 `src/lib/generation-provider.ts`: provider capability/config/result/error contracts, registry/factory.
- `src/lib/comfyui-client.ts`: 기존 API를 유지. `LocalComfyUIProvider` adapter가 이를 감싼다.
- 신규 `src/lib/providers/<provider>-image-provider.ts`: 선택된 공식 hosted image endpoint 한 종류에 한정.
- 신규 `src/lib/generation-settings.ts`: local profile config read/write, secret 저장 adapter, provider URL validation.
- 신규 `src/components/GenerationProviderSettings.tsx` 및/또는 Collection의 `GenerateImagePanel.tsx`.
- 기존 `AIHub.generateImage(pkgId, workflow)`와 `waitForImage(jobId, pkgId)`를 사용 가능한 경우 재사용. hosted provider 결과는 AIHub의 `addImageAsset(pkgId, asset)`를 통해 등록하고 source/provider/model/licensing/savedAt metadata를 기록한다. Signed/private URL이나 만료 가능 URL이면 결과를 장기 저장 가능한지 확인한다.
- WebLLM/text LLM provider와 media generation provider는 타입·UI·key namespace를 분리한다.

권장 최소 contracts (기존 타입 체계를 확인 후 조정):

```ts
export type GenerationCapability = {
  image: boolean;
  video: boolean;
  local: boolean;
};

export interface GenerationProvider {
  id: string;
  label: string;
  capabilities: GenerationCapability;
  validate(signal?: AbortSignal): Promise<{ ok: boolean; message?: string }>;
  generateImage(input: {
    prompt: string;
    negativePrompt?: string;
    width?: number;
    height?: number;
    signal?: AbortSignal;
  }): Promise<GeneratedMediaResult>;
}
```

Do not declare video support in a shared interface unless at least one implemented provider supports it end-to-end; alternatively make video method optional and gate on capability. `GeneratedMediaResult` should include `providerId`, `modelId`, `mimeType`, `blob` or validated downloadable output, and provider job metadata excluding secrets.

## 17.4 Local ComfyUI connection: implementation checklist
1. Audit current ComfyUI `getStatus()` behavior (`GET /prompt` may not be a reliable health/capability endpoint); identify appropriate endpoint for installed ComfyUI version.
2. Allow user to set URL; validate `http(s)`, host, port, no embedded credentials, no `file:`/`javascript:`. Restrict public website inputs to localhost/private-LAN URLs by default. If user explicitly enables remote endpoint, warn that prompt and outputs go to that host.
3. Handle mixed content, CORS, private network access, IPv4/IPv6, loopback DNS and browser secure-context behavior on Chrome/Firefox/Safari. Test from the actual deployed HTTPS origin. Do not infer it works because curl from the Mac works.
4. Test connection and report ComfyUI version, online status, required nodes/checkpoints when available. Current `getStatus()` may only expose a minimal response and `models` can be empty; do not present empty models as confirmed capability.
5. Ensure the selected workflow's checkpoint and node classes exist. Existing `DEFAULT_WORKFLOW` / `VIDEO_WORKFLOW` placeholders and IDs must not be treated as portable without real ComfyUI workflow validation.
6. Submit prompt; poll via current `ComfyUIClient` job/history flow. Test timeout, failed job, cancelled wait, output download, URL creation and resource cleanup.
7. Prevent arbitrary URL/SSRF behavior: validate endpoint, do not follow user-entered URL redirects to privileged hosts, avoid sending credentials, and explain network destination.
8. Keep local endpoint config per-browser/device; never synchronize it via P2P.

## 17.5 BYOK security/storage checklist
- Treat a browser-entered API key as exposed to the user's browser environment, extensions, XSS, and any script on the page. Clearly disclose this tradeoff; BYOK is not server-side secret storage.
- Prefer memory-only key for session in MVP. If persistent “remember key” is later requested, explicit opt-in, origin-scoped storage, clear-key control, no sync/P2P, and security review are required. Browser localStorage is readable by same-origin JavaScript and must not be described as encrypted vault.
- Never commit `.env.local`, keys, test tokens or real provider payloads. Do not add user key to `VITE_` variables, analytics, exception message, console output, URL, referrer, asset metadata, history, or broadcast.
- Direct provider requests use the exact official auth header and endpoint. No generic proxy that logs authorization headers.
- Validate `https` provider base URL; for fixed provider implementations do not let arbitrary user base URLs become unrestricted fetch/SSRF vector.
- Explain that localComfyUI prompts stay on their chosen ComfyUI endpoint, while BYOK requests go to the selected provider; generated result URL may be hosted by provider and have expiry/retention terms.

## 17.6 Image/video generation support matrix and gates
| Provider path | MVP support | Required proof before “available” |
|---|---|---|
| User local ComfyUI image | Target | HTTPS live-origin browser test; workflow accepted; output saved to Collection |
| User local ComfyUI video | Not assumed | Video nodes/model available; real short render; job/result persistence tested |
| Hosted BYOK image | One provider after selection | Official image endpoint/model docs; CORS/auth; mock contract tests; user-key opt-in smoke test |
| Hosted BYOK video | Later | Official video endpoint, asynchronous job polling, pricing/quota, storage/retention, cancellation reviewed |
| In-browser WebGPU image | Later research | Target-device model load/render benchmarks, mobile/memory compatibility, model license |
| Free tier | Provider/account-specific | Current official quota/region/account constraints surfaced; never promise unlimited free |

## 17.7 Phased implementation plan
### Generation Phase A — Provider contracts and security design
- [ ] Inspect and preserve dirty working tree.
- [ ] Select exactly one BYOK image provider based on official current docs and supported browser CORS, or defer BYOK if unsuitable.
- [ ] Choose key lifecycle (MVP session memory recommended), provider URL policy, quota/pricing disclosure and logs policy.
- [ ] Define capabilities, error types, generated output lifetime and local ComfyUI URL policy.
- **Gate:** documented decision, no implementation that silently sends keys to an unverified endpoint.

### Generation Phase B — Local ComfyUI image MVP
- [ ] Implement user-configured local ComfyUI URL and validation.
- [ ] Reuse existing `ComfyUIClient` and AIHub create/submit/wait path.
- [ ] Add UI for URL, test connection, prompt, width/height/workflow selection and generation state.
- [ ] Add explicit save-to-package step and show local provider/model source.
- [ ] Unit tests for URL validation, provider adapter, connection fail, job fail/timeout/success and asset registration.
- [ ] Browser test from `https://privseai.com` to localhost across supported browsers; document required ComfyUI CORS config if feasible.
- **Gate:** HTTPS page can complete a local ComfyUI image job and show/save output on a real user machine. If browser network policies block it, do not claim localhost provider works; evaluate a packaged desktop bridge/local companion service as a separate design.

### Generation Phase C — One audited hosted BYOK image provider
- [ ] Add session-only key input and erase on clear/tab close where feasible; never require a key for local ComfyUI.
- [ ] Implement only documented endpoint, supported model and response type.
- [ ] Add API key validation without triggering paid image generation if provider supports safe validation. Otherwise communicate that a test image may be billable and require opt-in.
- [ ] Add cost/quota disclaimer and official pricing/model links; quote no fixed free amount unless current provider docs support it.
- [ ] Mock tests: auth header, CORS-visible failures, 401, 403, 429, timeout, abort, malformed response, image download failure, expired URL.
- [ ] Optional live smoke test only with user-supplied key, explicit approval and known cost; scrub key/output data from logs.
- **Gate:** API can create image, decode/store output, register AIHub asset; key absent from persisted state/P2P.

### Generation Phase D — PromptLab wiring
- [ ] Connect PromptLab analyzer output to provider-agnostic editable prompt field.
- [ ] Analyzer never selects or invokes provider automatically.
- [ ] User can choose local vs BYOK after editing prompt and see destination before generation.
- [ ] Show generated output origin distinct from reference image/source stock image.

### Generation Phase E — Video and local WebGPU research
- [ ] Audit ComfyUI video workflow/model support and available hosted video API independently.
- [ ] Only proceed with a real endpoint, job lifecycle, pricing/quota disclosures, max duration and output persistence plan.
- [ ] For in-browser video/image diffusion, benchmark WebGPU and model size; separate from current WebLLM text path.
- [ ] New estimate and design approval before implementing.

## 17.8 Tests and acceptance criteria
### Unit/integration tests
- Local endpoint validation rejects malformed protocol, credentials, unexpected public host when local-only mode is on, and invalid port.
- BYOK provider never serializes key into settings/package/log/P2P payload.
- Prompt is mapped to correct workflow/input; unsafe workflow nodes/unknown result formats fail safely.
- Provider errors (offline, CORS/network, 401, 429, 5xx, timeout, abort) map to clear UI states.
- Generated image URL/blob is fetched/decoded and persists in correct AIHub package; local provider metadata differs from BYOK provider metadata.
- Stock image safety/licensing behaviors continue to pass; generated output is not mislabeled as licensed stock.
- Video capability false means no enabled video generation action.
### Required commands
```bash
npx tsc --noEmit
npx vitest run
npm run build
```
Manual acceptance, when possible:
1. From `https://privseai.com`, select local ComfyUI, test connection, generate a small image using a valid installed workflow.
2. Confirm prompt destination is the user's local ComfyUI, not PrivseAI server.
3. Confirm generated image can be saved to an explicitly selected Collection package.
4. BYOK provider test only with user-supplied key and prior cost confirmation.
5. Inspect storage, package export and P2P payload; no key or source file bytes exist there.

## 17.9 Product wording constraints
Use accurate UI copy:
- “Run on your computer (ComfyUI)” — only after live-origin connection is proven on the browser/device.
- “Use your provider key (usage may incur charges)” — whenever provider sends billable API requests.
- “Free quota may be available; limits depend on provider/model/account” — only with current official reference.
Avoid:
- “Free unlimited image/video generation”
- “PromptLab generates images/videos” (it analyzes/builds prompts unless separate backend is invoked)
- “Runs locally/private” when request goes to a hosted BYOK provider.

**Implementation status:** 계획만 기록. 이 문서 추가만으로 어떤 provider도 실제 연결되거나 생성이 가능해지는 것은 아니다.


---

**PromptLab implementation status (2026-10-10):** Added `src/lib/prompt-analyzer.ts` for Gemini image-to-prompt and text-idea expansion, `src/components/PromptStudio.tsx` for UI, and mounted it in the Collection Images tab. API key stays in React component state and is sent directly to Google using `x-goog-api-key`; it is not persisted. Mock tests were added. PromptLab does not generate media: video analysis and generation-provider handoff remain unimplemented. In the current worktree, full TypeScript/build verification is blocked by other untracked Nexus imports referencing the missing `src/lib/nexus-client.ts`.

# 18. Nexus + 사용자 디바이스 기반 무료 채팅 설계
> 목표: `privseai.com` 채팅 UI는 PrivseAI에서 제공하고, 실제 LLM 추론은 선택한 실행 경로에서 수행한다. Nexus는 provider/router gateway 역할이며, Nexus 설치만으로 모델 추론이나 무료 사용량이 생기는 것은 아니다. 무료 경로는 **사용자 기기에서 실행하는 로컬 모델** 또는 명시적으로 이용 가능한 provider quota뿐이다.

## 18.1 목표 아키텍처 결정
### 기본 권장: 사용자 기기에서 Nexus + 로컬 LLM
```text
privseai.com Chat UI (HTTPS)
        │ user explicitly connects a device
        ▼
Nexus Companion (user device, bound to 127.0.0.1 only)
        │ Nexus OpenAI-compatible /v1/chat/completions
        ▼
Local provider on that device (Ollama / vLLM / LM Studio)
        │
        ▼
User's CPU/GPU/RAM performs inference; no hosted token/model bill from PrivseAI
```
- Nexus는 user device에서 로컬 LLM runtime을 OpenAI/Anthropic-compatible chat API로 변환·라우팅한다.
- Nexus는 연결된 local model을 자동 제공하지 않으므로 사용자 기기에서 runtime과 모델을 별도 설치/다운로드해야 한다.
- 무료라는 표현은 “이 경로에서 별도 hosted API charge가 발생하지 않음”을 뜻한다. 전력, 하드웨어, 디스크·모델 다운로드 비용과 장비 성능 제한이 있다.
- chat request를 browser에서 localhost Nexus로 직접 보내는 방식은 HTTPS/CORS/private-network/browser compatibility 때문에 MVP의 유일한 연결 방식으로 채택하지 않는다.

### Fallback A: PrivseAI server에서 Nexus + local server model
```text
privseai.com → authenticated PrivseAI API → Nexus (private network) → server local model
```
서버 모델·GPU가 준비된 경우에만 쓸 수 있다. 서버에서 CPU/GPU, RAM, model availability를 직접 확인해야 한다. server Nexus를 public unauthenticated proxy로 노출하면 안 되며, private bind, auth, rate-limit, per-user quota, abuse/cost controls, privacy/retention policy가 필요하다. 현재 110 server에서 Nexus/model/GPU가 작동 중이라고 간주하지 않는다.

### Fallback B: 사용자 선택 hosted BYOK
사용자가 provider 계정/key를 명시적으로 설정하고, 해당 provider의 공식 chat API를 호출한다. 사용량/결제/무료 quota는 provider 계정에 따른다. Nexus가 key를 보관/중계해야 한다면 key storage, auth, logging, billing boundary를 별도 위협 분석하고 “키는 브라우저에만 있다”는 문구를 쓰지 않는다.

## 18.2 Browser-to-device 연결 결정
`https://privseai.com` public site → `http://127.0.0.1:<port>` 접근은 browser마다 secure context, CORS, Private Network Access / Local Network Access prompt, OPTIONS preflight, firewall 및 OS behavior에 좌우된다. Chrome PNA rollout 상태도 변경될 수 있으므로 browser assumption으로 처리하면 안 된다. 관련 배경: [Chrome Private Network Access update](https://developer.chrome.com/blog/private-network-access-update-2024-03), [PNA rollout on hold](https://developer.chrome.com/blog/pna-on-hold).

### MVP에서 권장할 연결 방식: local companion bridge
1. 사용자 장치에 서명된/검증 가능한 PrivseAI companion 앱(또는 제한된 local bridge)을 제공한다.
2. bridge는 loopback interface에만 bind하고, startup 때 짧은 수명의 pairing code를 생성한다.
3. 사용자 브라우저가 PrivseAI site에서 pairing code를 명시적으로 입력/확인하고, bridge는 one-time challenge/nonce로 site origin + pairing을 승인한다.
4. 승인 완료 후 browser-device 연결은 다음 중 검증된 방식으로 한다:
   - 브라우저에서 localhost HTTPS/CORS/PNA permission이 안정적으로 동작하는 조합이면 strict allowlisted endpoint로 직접 호출
   - 아니면 companion의 outbound WebSocket/WebRTC tunnel을 relay하여 웹 앱이 bridge와 통신 (짧은 수명 pairing token, E2E/relay visibility 문구 필요)
5. bridge는 Nexus를 subprocess로 실행하거나 Nexus localhost port를 호출한다. **Nexus port를 LAN/public interface에 직접 노출하지 않는다.**
6. bridge는 허용된 chat route/model만 proxy하며 admin/config/log/filesystem routes를 browser에 노출하지 않는다.
7. Pairing revoke, disconnect, token expiry, origin allowlist, request size/rate limits를 구현한다.

MVP가 packaged desktop app을 제공하지 않는다면, browser-local bridge는 별도 설치가 필요하다는 점을 명확히 보여준다. 일반 방문자에게 몰래 software download/install을 시도하지 않는다. Extension을 택할 경우 Chrome/Firefox store 배포·permissions·review를 별도 범위로 둔다.

### 대안 평가
- **Direct browser localhost fetch:** 구현은 빠르나 target browsers에서 deployed HTTPS origin 테스트가 모두 통과하고, Nexus/adapter가 strict CORS/PNA, origin allowlist, auth를 제공할 때만 enable. `Access-Control-Allow-Origin: *`를 사용하지 않는다.
- **Nexus LAN bind:** 기본 금지. remote client support가 필요하더라도 private network ACL/VPN + TLS + strong auth가 있어야 하며, untrusted network에서는 비활성화.
- **Public relay:** 모든 prompt/token이 host를 통과할 수 있다. Relay는 model inference는 안 해도 운영비·대역폭·abuse risk가 발생하므로 별도 privacy/cost consent 필요.

## 18.3 Nexus 배포 경계와 설치 역할
“`privseai.com`에 Nexus 설치하고 유저 디바이스에도 설치”라는 요구는 실제로는 두 deployment role로 분리한다:

1. **PrivseAI hosted control plane (optional):** Nexus server는 여러 remote providers를 routing할 수 있지만, 서버에서 모델을 실행하려면 model runtime/provider credentials/hardware가 필요하다. Nexus는 스스로 무료 inference 공급자가 아니다.
2. **User device agent (required for user-resource model):** user installs Ollama/LM Studio/vLLM + selected model + PrivseAI local companion/Nexus. Model inference occurs locally; chat contents reach the local runtime. Pairing/routing only is via PrivseAI UI.

Nexus README와 current runtime config에서 실제 version의 bind address, auth, admin endpoints, provider configuration, streaming, local backend setup을 확인하고 pin한 release/commit을 사용한다. README에 없는 auth 또는 secure multi-tenant isolation을 가정하지 않는다. Nexus가 MIT인지 README/license에 대해 검증하지 않고 dependency/redistribution 결정을 하지 않는다. (Nexus repository: https://github.com/rachidSabah/Nexus)

## 18.4 Chat UI 및 endpoint contract
- Existing `src/components/CandyChat.tsx` and/or `CompanionChat.tsx` are the user experience entry points; inspect their provider/chat adapter before implementation.
- Add a `ChatProvider` interface for message request + optional stream + abort, keeping current AI path intact.
- Provider options should be explicit: `Device (Local/Nexus)`, `PrivseAI hosted (only if real model is provisioned)`, `Bring your provider`.
- Nexus adapter uses only tested compatible endpoint (e.g. OpenAI `POST /v1/chat/completions`) with configured base URL/model, message serialization and streaming parsing. Inspect Nexus exact auth requirement first; never assume no auth.
- Support SSE `data:` chunks, `[DONE]`, partial UTF-8 chunks, malformed frame, network abort and provider errors. If Nexus does not support requested stream/model combination, fallback to non-streaming with clear UI status.
- Map user/assistant/system roles deliberately; do not forward hidden keys/system config or unrelated companion state.
- Device-local chat history is user-visible and locally persisted only if explicitly enabled. Prompt/history sync and P2P sharing default off.
- If companion persona/card content is inserted into system prompt, display destination (local device vs provider) before first remote/hosted request and allow disabling persona context.

## 18.5 User-facing workflow
1. User opens Chat → selects “Use my device (free local inference)”.
2. UI explains install requirements, model download size, hardware implications and that no unlimited/fast performance is guaranteed.
3. User installs local model runtime and PrivseAI companion (or a documented manual Nexus/LLM setup).
4. Pairing is initiated by user; show device name, Nexus endpoint origin and one-time code. Do not transmit reusable admin password/API key through URL or chat.
5. Companion validates local Nexus health and selected model with a non-billable metadata request.
6. User explicitly approves pairing; PrivseAI stores an opaque pairing reference/token with short expiry, not Nexus admin credentials.
7. Chat screen shows `Local device • <model>` and disconnect/revoke button. If local device disconnects, never silently fallback to paid hosted provider; ask before switching.
8. Optional hosted BYOK provider has a separate explicit consent, key setup and cost/quota notice.

## 18.6 Threat model and safeguards
- **Cross-site request forgery to localhost:** local bridge validates exact `Origin`, `Host`, allowed methods/routes, CSRF token/nonce and pairing; rejects any untrusted web origin.
- **Browser access policy:** test actual Chrome/Firefox/Safari stable versions from `https://privseai.com`; secure context alone does not guarantee localhost fetch works.
- **Nexus admin leakage:** never expose dashboard, config, provider secret, filesystem, logs or unrestricted proxy endpoints to browser/relay.
- **Remote code execution:** no user-provided Nexus plugin/provider script or arbitrary shell/model path from web UI.
- **LAN/public exposure:** Nexus/bridge loopback-only by default; firewall reminder; no `0.0.0.0` default.
- **Malicious prompts / resource exhaustion:** clamp context size, max output tokens, request concurrency, generation duration; user can stop generation; local runtime process resource limits if supported.
- **Privacy:** indicate each message destination; don't log full prompt by default; redact auth headers; retention/telemetry opt-in; provide clear local history deletion.
- **Pairing theft:** one-time code short TTL, user confirmation on both ends where possible, token rotation/revoke, bind token to user/device and exact allowed routes.
- **Relay trust:** if relay is used, disclose that relay can observe metadata/traffic unless E2E encryption is implemented and independently verified. Do not claim E2E based solely on WebRTC transport without key management review.
- **Free-tier abuse:** free local inference costs PrivseAI no model API charge but relay/signaling/bandwidth still cost; hosted Nexus/model capacity needs auth, limits and abuse handling.

## 18.7 Implementation phases
### Nexus Chat Phase 0 — source and runtime audit
- [ ] Inspect pinned Nexus source/docs and license; identify authenticated routes, bind settings, CORS, streaming, local model provider setup, admin/dashboard routes.
- [ ] Inspect current PrivseAI `CandyChat.tsx`/`CompanionChat.tsx`, config/key handling, messages/history, on-device LLM, existing API clients.
- [ ] Verify target user-device OS/browser scenarios, deployment permissions and packaging approach (desktop bridge vs extension vs manual runtime).
- [ ] Draw data-flow diagram per provider and decide whether a relay is required.
- **Gate:** no coding until route/auth and client install/discovery model are proven.

### Nexus Chat Phase 1 — adapter-only prototype
- [ ] Add `NexusChatProvider` behind feature flag in dev only; base URL configurable, default loopback not hardcoded in production.
- [ ] Implement `/v1/chat/completions` non-streaming request with explicit model selection, timeout and abort.
- [ ] Add mock tests for success, 401, 404/model missing, connection refused, invalid response, timeout, abort; verify key redaction.
- [ ] Test from a locally served HTTPS app and supported browsers; record CORS/PNA failures. Do not deploy feature if direct local fetch is blocked.
- **Gate:** local proof-of-concept only; no public Nexus endpoint.

### Nexus Chat Phase 2 — safe user-device pairing MVP
- [ ] Build `privseai-local-agent` companion with loopback-only bridge and one-time pairing; it may launch Nexus or connect to a user-run Nexus.
- [ ] Bridge allowlists only health/capability/chat/completions endpoints; does not proxy Nexus admin/API-key management.
- [ ] Implement connect/revoke/device status UX and no-silent-provider-fallback rule.
- [ ] Test origin validation, CSRF, token TTL/revoke, route denial, malformed requests, token redaction, cross-user pairing isolation.
- **Gate:** external security review of local bridge before production release.

### Nexus Chat Phase 3 — optional hosted server Nexus
- [ ] Deploy only if server model/hardware/provider budget is intentionally provisioned.
- [ ] Keep Nexus private behind authenticated API gateway; user auth, quotas, rate limits, per-user provider credentials, abuse monitoring and model billing recorded.
- [ ] No public unauthenticated `/v1` route and no shared admin credentials.
- [ ] Declare hosted inference costs; do not label it “free local chat”.
- **Gate:** load/security/cost and privacy review before public users.

## 18.8 Acceptance criteria
- User can select local-device Nexus and see exact destination/model.
- No-message path hits hosted providers unless user explicitly approves fallback.
- Local endpoint is inaccessible to arbitrary websites and LAN devices by default.
- Nexus admin/config/provider key endpoints are not forwarded by the browser bridge.
- Stream and non-stream modes behave correctly; stop generation stops supported local request.
- Pairing can be revoked; revoked token stops working immediately.
- Browser/device install requirements are clearly explained; no hidden install attempts.
- Provider error does not leak keys or transcript to logs.
- Unit/integration tests, `npx tsc --noEmit`, `npx vitest run`, and `npm run build` pass.
- A real-device smoke test on at least one supported OS/browser confirms local model inference; tests with mocked Nexus do not count as real inference verification.
- Performance is reported as device/model-specific, not promised universal latency or quality.

**Implementation status:** design only; no Nexus server/agent/chat code is installed or deployed by this document.
