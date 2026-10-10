# PrivseAI World — 통합 작업 가이드 (Claude Code / AI 에이전트용)

> **대상 독자:** Claude Code, GitHub Copilot, 그리고 privseai-trystero 코드베이스에서
> 작업을 이어받는 모든 AI 에이전트.
>
> 이 문서는 외부 프로젝트 통합 기록과 운영 규칙을 한 곳에 모아, 다음 에이전트가
> "이미 무엇이 통합되었고, 무엇을 조심해야 하는지"를 빠르게 파악하도록 한다.

---

## 1. 저장소 컨텍스트

- **서비스**: `privseai.com` (P2P 탈중앙 AI 컴패니언 네트워크 — "Network Cockpit")
- **스택**: Vite + React + TypeScript, Cloudflare 프록시 뒤의 110 서버(185.55.240.110)에서 정적 호스팅
- **빌드 산출물**: `dist/` (Vite build) → Caddy `file_server`가 `/var/www/privseai/`에서 직접 서빙
- **백엔드**: 같은 110 서버에서 fellowship/gf/omniroute 컨테이너 실행 (`docker-compose.inference.yml`)
- **Git remote**: `github.com/koraussie7/chat.privseai.git`

---

## 2. 완료된 통합 (2026-10-10)

### 2.1 Picsum + Wikimedia Stock Image 통합

**왜 이걸 골랐나**: Unsplash Source API(`source.unsplash.com`)가 2024년부터 503을 반환해서
죽었다. Wikimedia Commons는 진짜 키워드 검색이 되지만 CORS가 까다롭고, **랜덤/다양성**은
약하다. 그래서 두 개를 결합: Wikimedia는 **검색용**, Picsum은 **랜덤 fallback + 시각 다양성용**.

**흐름**:

```
사용자 입력 (검색어)
   ↓
searchAllStock({ query, count })
   ├─ searchPicsum()       → Picsum /v2/list 페이지 랜덤 슬라이스, Unsplash License
   └─ searchWikimedia()    → Commons API, CC/PD 라이선스만 통과
   ↓
UI: StockImageSearch (CandyDiscover 상단 + CandyCollection Images 탭 상단)
   ↓
+ Attach → aiHub.addStockImage(pkgId, stock)
   ↓
ImageAsset (isNSFW=false, metadata.source, metadata.license 보존)
   ↓
sharePackage() 호출 시 → _stripStockAssets()가 자동으로 stock을 분리해서 P2P 브로드캐스트에서 제외
```

**핵심 파일**:

- `src/lib/stock-image-client.ts` — 두 소스의 unified 클라이언트 + ImageAsset 변환기
- `src/components/StockImageSearch.tsx` — 검색 UI (컴패넌트, `useAIHub()` 훅 사용)
- `src/lib/ai-hub.ts` — `addStockImage()`, `getPackageImagesStock()`, `getPackageImagesGenerated()`, `_stripStockAssets()`
- `src/components/CandyDiscover.tsx`, `src/components/CandyCollection.tsx` — 마운트 위치

**주의할 함정 (이미 한 번 밟음)**:

1. **Wikimedia `iiprop` 파라미터**: `"url|thumburl|size|mime|extmetadata"` 같이 쓰면
   Wikimedia가 `thumburl` 필드를 빼버린다 (보안 정책). `"url|size|mime|extmetadata"`만
   쓰고, thumb URL은 `iiurlwidth` 파라미터로 자동 생성 받는다.
2. **Unsplash Source API 죽음**: 더 이상 사용 불가. Picsum으로 대체.
3. **VideoAsset에는 `metadata` 필드가 없다**: `sharePackage` P2P 게이트에서
   `(v as unknown as { metadata?: ... }).metadata` 캐스팅이 필요. 헬퍼 `_stripStockAssets`
   안에 이미 처리되어 있음.

**테스트**:

- `src/tests/stock-image-client.test.ts` — 5 tests
- `src/tests/ai-hub-stock.test.ts` — 3 tests
- 전체: **142/142 통과** (회귀 없음)

---

### 2.2 `privseai.com` 배포 (2026-10-10)

**배포 흐름 (재현용)**:

```bash
# 1) 로컬 빌드
cd /Users/brianyeon/CodeGPT/integration-finalize/privseai-trystero
npm run build

# 2) 백업
ssh 110 "cd /var/www && tar czf /tmp/privseai-pre-deploy-\$(date +%Y%m%d-%H%M%S).tgz privseai/"

# 3) rsync (보존할 자산은 exclude)
rsync -av --delete \
  --exclude='*.map' \
  --exclude='images/' --exclude='build/' --exclude='menu/' \
  --exclude='dada-*' --exclude='_redirects' \
  --exclude='.bak*' --exclude='index.html.bak-*' \
  ./dist/ "110:/var/www/privseai/"
```

**110 서버의 Caddy 블록** (참고):

```
privseai.com {
    root * /var/www/privseai
    file_server
    try_files {path} {path}/index.html /index.html
}
```

**배포 검증**:

```bash
curl -sS "https://privseai.com/collection" | grep -oE 'index-[A-Za-z0-9]+\.js'
# → 빌드한 dist/index.html의 해시와 동일해야 함
```

**알려진 함정**:

- `/var/www/privseai/`는 root만 직접 수정 가능 (`ssh 110`은 root로 들어감).
  일반 유저로 작업 시 `sudo` 필요.
- Cloudflare 프록시 뒤에 있어서 **캐시 무효화는 자동**이지만, JS 파일명이
  해시 기반이라 새 배포 = 새 URL = 자동으로 캐시 bypass.

---

## 3. 검토 완료된 외부 통합 (통합 안 함)

### ❌ `annuenola/galaxy-gallery-gleaner` (E-Hentai 다운로더)

**기각 사유**: 자동 다운로드는 E-Hentai/ExHentai ToS 위반. privseai 서버 IP(185.55.240.110)
에 adult-content 자동 다운로더를 얹으면 reputation 오염 + 법적 리스크. NSFW 콘텐츠가
자동으로 privseai 호스팅에 들어옴 → 안전하지 않음.

### ✅ `gracech0322-cmd/promptlab-image-video-to-prompt` (Phase 1 권장)

**이게 뭔가**: Chrome extension, 로컬 이미지/비디오 → Gemini API 분석 → 구조화된 prompt.
이미지/비디오를 Seedance 2.0-style prompt로 변환. MIT 라이선스.

**왜 가치 있나**:

1. 사용자가 좋아하는 일러스트/영상을 업로드 → 자동 prompt 추출 → 그걸로 즉시 ComfyUI 재생성
2. P2P 캐릭터 카드에 prompt 필드를 추가하면 다른 피어가 "디지털 DNA"를 받아서 재학습 가능
3. Gemini API는 사용자 부담 (privseai의 다른 API 키 흐름과 일관)

**다음 단계 (선택)**:

- `src/lib/prompt-analyzer.ts` 추출 (extension 의존성 제거, Gemini 직접 호출)
- CandyDiscover/CandyCollection에 "Upload + Analyze" 버튼
- 캐릭터 카드 v2 스키마에 `prompt` 필드 추가 + P2P 직렬화
- 비디오: Seedance-style prompt → ComfyUI VIDEO_WORKFLOW 매핑

### ✅ `0xzr/freellmpool` — 통합 완료 (2026-10-10)

** 이게 뭔가**: 22개 무료 LLM 프로바이더(178 chat route)를 하나의 OpenAI 호환
엔드포인트로 묶는 MIT 게이트웨이. 자동 failover + 일별 프로바이더 부하 분산.
키 없이(keyless route)도 구동 가능.

**통합 방식**: freellmpool 자체에는 유저 개념이 없어서(단일 `proxy_key`,
글로벌 쿼터), 앞단에 `server/quota-gateway.py`(stdlib Python)를 얹어
**유저별 일일 요청/토큰 쿼터**를 구현:

```
browser ──(Bearer qp_...)──▶ Caddy /freellm/* ──▶ quota-gateway :4005 ──▶ freellmpool :8080
```

- 유저 키: 브라우저가 자동 발급(`localStorage["privsei.quota.key"]`),
  등록 키는 `POST /v1/keys` + `ADMIN_TOKEN`으로 발급(유저별 한도 지정 가능)
- 한도 초과 시 OpenAI 스타일 429 + `X-Quota-Reset` 헤더
- 기본 한도: 100 req / 200K tokens 유저별 UTC일 (env 조정)
- 채팅은 `multi-model-client.ts`의 priority 2 엔드포인트로 자동 failover에 포함
- 상세: `INTEGRATION_FREELLMPOOL.md`

**핵심 파일**: `server/quota-gateway.py`, `src/lib/freellmpool-client.ts`,
`src/tests/freellmpool-client.test.ts` (11 tests), docker-compose의
`freellmpool`/`quota-gateway` 서비스, Caddyfile의 `/freellm` 블록.

**주의**: 쿼터는 advisory — 프로바이더 실제 무료 한도를 보장하지 않음.
ToS 관점에서 무료 티어 재방출은 gray area (INTEGRATION 문서의 Caveats 참고).

---

### 검토 대기

- `meshtastic/network-management-client` — LoRa 메시 네트워크 관리 데스크톱 앱.
  privseai는 Cloudflare/WebRTC 의존이라 직접 통합은 어려움. 가능하면 어댑터 레이어
  (LoRa ↔ WebRTC bridge)로 loose coupling만 추천. 우선순위 낮음.
- `annuenola/galaxy-gallery-gleaner` — 위 기각 사유로 재검토하지 않음.

---

## 4. 통합 시 절대 규칙

1. **NSFW 자동 다운로드는 금지**: 어떤 외부 통합에서도 E-Hentai/ExHentani/Gelbooru/
   Danbooru 같은 ToS 위반 소스는 자동화하지 않는다. 사용자가 **수동으로 업로드**한
   이미지에 한해 AIHub `addImageAsset`로 받는다 (기존 P2P_ADULT_AI_PLAN 정책).
2. **라이선스는 사용자 메타데이터로 보존**: Stock image 통합은 `metadata.source`,
   `metadata.license`, `metadata.author`를 ImageAsset에 저장한다. P2P 브로드캐스트
   시 `_stripStockAssets()`가 자동 분리 → 라이선스 표기 의무가 있는 콘텐츠는 재배포
   금지. UI에서도 라이선스/저자 크레딧을 표시한다.
3. **P2P는 항상 safe-by-default**: `sharePackage()` 진입 시 (a) P2P 클라이언트 없음,
   (b) peer 0, (c) stock-only — 이 세 가지 게이트를 통과해야 broadcast. 새 asset 타입
   추가 시에도 같은 게이트를 통과해야 한다.
4. **TypeScript 0 errors, vitest all green**: 새 통합 추가 후엔 반드시
   `npx tsc --noEmit` + `npx vitest run` 통과.
5. **빌드 검증**: `npm run build` 성공 + `dist/assets/index-*.js` 해시 변경 확인.

---

## 5. 작업 시작 전 체크리스트

다음 에이전트가 이 저장소에서 작업을 시작할 때, 이 순서로 확인한다:

1. **현재 헤드 확인**: `cd /Users/brianyeon/CodeGPT/integration-finalize/privseai-trystero && git log --oneline -5`
2. **빌드 산출물 신선도**: `ls -la dist/assets/index-*.js` vs `ssh 110 "ls -la /var/www/privseai/assets/index-*.js | tail -1"` — 해시가 다르면 새 배포가 진행 중일 수 있음
3. **TypeScript 상태**: `npx tsc --noEmit`
4. **테스트 상태**: `npx vitest run`
5. **stock image 통합 살아있는지**: `grep -n "searchPicsum\|searchWikimedia\|addStockImage" src/lib/ src/components/` — 핵심 함수들 존재 확인
6. **이 문서의 "절대 규칙" 다시 읽기** — 그 다음에 작업 시작

---

## 6. 자주 묻는 것 (FAQ)

### Q: 새 외부 저장소를 통합하려면?

1. 먼저 **절대 규칙 1~3** 확인 — 특히 NSFW 자동 다운로드 금지, 라이선스 보존, P2P 게이트
2. 통합 가치를 분석한 문서를 `INTEGRATION_<name>.md`로 추가
3. 이 문서의 "3. 검토 완료된 외부 통합" 섹션에 결정(통합/기각/보류) 기록
4. 통합 진행 시 `src/lib/<name>-client.ts` 형식으로 standalone 모듈 분리
5. AIHub 연동이 필요하면 `ai-hub.ts`에 `addXxxAsset` 패턴 (stock 통합 참고)
6. UI는 별도 컴포넌트로 분리, 기존 페이지에 직접 마운트하지 말고 패널 형태로 추가

### Q: P2P 보안을 건드릴 변경을 하려면?

`sharePackage()`, `_serializeForNetwork()`, 그리고 모든 `_strip*` 함수를 다시 읽고,
새 asset 타입도 같은 strip 게이트를 거치도록 한다. 누락 시 민감한 데이터가 peer에게
유출될 수 있음.

### Q: 110 서버에 직접 변경하려면?

- `ssh 110`은 root로 들어간다. 위험한 명령은 사전 확인.
- Caddy 설정 변경 시 `systemctl reload caddy` (자동 reload는 안 됨)
- 백업은 항상 `/tmp/`에 timestamp 포함 파일명으로
- 컨테이너 변경은 `docker-compose.inference.yml` + `deploy-inference.sh`

---

**최종 업데이트**: 2026-10-10, stock image 통합 + PromptLab 가치 분석 통합.
**담당 에이전트**: Claude (Sonnet 4.5 계열)
**연락**: 새 결정은 이 문서에 직접 commit message 형식으로 추가한다.
