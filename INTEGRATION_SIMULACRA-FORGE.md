# INTEGRATION ANALYSIS: simulacra-forge (janaador0827-commits)

**Date**: 2026-10-10
**Verdict**: ❌ **기각 — 악성 의심 저장소. 절대 통합/클론/실행 금지**

---

## 요약

README는 "Cipher Nexus"라는 FastAPI 기반 자율 멀티에이전트 대화 시스템을
마케팅하지만, 저장소 전체를 조사한 결과 **실제로 존재하는 코드는 없다**.
대신 난독화된 악성 로더와 가짜 커밋 자동화 워크플로가 발견되어,
malware 배포용 cloaking 저장소 또는 star-farming 스팸으로 판단된다.

## 조사 근거 (2026-10-10, GitHub API로 직접 확인)

### 1. README = 허구 (기능이 코드로 존재하지 않음)

| README 주장 | 실제 저장소 내용 |
|---|---|
| Python 3.12 + FastAPI, `uvicorn cipher_nexus.mesh:app` | `.py` 파일 **0개**. GitHub 언어 감지: **HTML** |
| Semantic mesh, WebSocket 스트리밍, React 대시보드 | 소스 코드 없음 |
| `protocol_seed.yaml`, Redis 의존성 | 해당 파일 없음 |
| MIT 라이선스 (badge 표시) | **LICENSE 파일 없음** (API `license: null`) |

저장소 전체 파일: `README.md`, `index.html`, `button.svg`, `preview.svg`,
`.github/VBNPlPTTWdXXwT`(가짜 로그), `.github/workflows/YgsakkTRYQJB.yml`.

### 2. `index.html` = 난독화 악성 로더 (치명적)

- base64로 인코딩된 XOR 암호문 블록 8개를 `display:none` div에 숨김
- 짧은 bootstrap 스크립트가 XOR 복호화(`^` + 28바이트 키) 후
  `document.body.innerHTML`에 주입하고 **추출한 `<script>`를 순서대로 재실행**
- 주석이 러시아어 (`/* Заголовок страницы */` = "페이지 제목",
  `/* Вытаскиваем <script> из body */` = "body에서 script 추출")
- GitHub Pages가 활성화됨 → 저장소의 정당성을 빌려 악성/피싱 페이지를
  `janaador0827-commits.github.io`에서 서빙하는 전형적인 **c2/malware 배포 cloaking**
- 정상 오픈소스 프로젝트가 페이지를 XOR로 암호화해 배포할 이유는 없다.
  봇/리뷰어에게는 무해해 보이고 실제 방문자에게만 페이로드를 보여주기 위한 것.

### 3. 가짜 커밋 공장 (activity farming)

`.github/workflows/YgsakkTRYQJB.yml`:
- `cron: '0 * * * *'` — **매시간** 실행
- 50개 무작위 동사 풀에서 단어 2개 + 랜덤 숫자로 커밋 메시지 생성
  (`"rollback log #7768"`, `"save format #6553"` 등 — 실제 변경 없음)
- `.github/VBNPlPTTWdXXwT` 로그 파일 끝에 ISO 타임스탬프 1행씩 무한 증가
- 커밋 히스토리가 전부 `github-actions[bot]`의 `rollback log`/`save format`
  반복 — 사람이 쓴 커밋 0개, 코드 변경 커밋 0개

### 4. 신뢰도 지표 부정합

- Stars 116 / **Forks 0 / Issues 0 / PR 0 / Subscribers 0** — 구매 추정
- 생성 2026-06-28, README·데코레이션 외 무변경 (모든 "활동"은 봇 로그)
- 저장소명 `simulacra-forge` ≠ README 제목 `Cipher Nexus` —
  README를 타 프로젝트에서 표절해 붙였을 가능성
- 계정 `janaador0827-commits` — 사용자 ID가 최근 생성된 throwaway/bot 패턴

## privseai와의 관련성

README의 표면 키워드(멀티에이전트, 캐릭터 에머전스, LLM)는
privseai의 컴패니언/P2P 테마와 겹쳐 "통합 후보"로 노출되기 쉬우나,
**통합 가능한 실체가 존재하지 않는다.**

## 결정: 기각 (절대 통합 금지)

- 클론/포크 금지 — `index.html` 난독화 로더는 클론 시에도 저장되며,
  실수로 브라우저로 열면 페이로드가 실행될 수 있음
- GitHub Pages URL(`janaador0827-commits.github.io/simulacra-forge/`)
  방문 금지
- 이 저장소를 "멀티에이전트 프레임워크"로 추천/링크하는 블로그·리스트는
  동일 스파마 네트워크이거나 우회당한 것일 수 있음
- 발견된 패턴(XOR 로더 + hourly 봇 커밋 + star 불일치)은 GitHub Trust &
  Safety 신고 대상 패턴. 필요 시 신고 버튼 활용 권장

## 재검토 조건

없음. 저장소가 전면 개편되어 실제 Python 소스 + LICENSE가 있고 봇 워크플로가
제거되기 전까지 영구 기각.
