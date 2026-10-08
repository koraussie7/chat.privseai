# Open Design 작업 요청서 — PrivseAI Luna 이미지·영상

## 목표

PrivseAI 웹사이트의 Featured 캐릭터 Luna를 위한 오리지널 Candy.ai-inspired 비주얼 에셋을 제작한다. 기존 SVG는 스타일 참고용으로만 사용하고, **복사하거나 변형한 트레이싱이 아닌 독창적인 결과물**을 만든다.

## 사용할 기존 에셋

- 캐릭터 이미지/스타일 참고: `public/images/luna-featured.svg`
- 캐릭터 설정 및 현재 이미지 경로: `src/data/candyPresets.ts`의 `id: "luna"` 항목
- 사이트에서 이미지가 쓰이는 주요 위치: 홈의 Featured 카드/탐색 그리드. 현재 Luna의 `avatarUrl`은 `/images/luna-featured.svg`로 설정되어 있다.

## 캐릭터 / 아트 디렉션

- Luna는 **23세 성인 가상 인물**이다.
- 직업: 디지털 일러스트레이터.
- 분위기: 로맨틱하고 다정하며 차분하고 세련된 Candy.ai-inspired 프리미엄 캐릭터 포트레이트.
- 스타일: **실사풍, 시네마틱 에디토리얼 사진**, 실제 사진처럼 자연스러운 피부 질감과 얼굴 비율, 정교하지만 과도하지 않은 메이크업.
- 배경: 블루아워의 아늑한 아틀리에, 창으로 들어오는 달빛, 흐릿한 캔버스와 따뜻한 작은 조명, 창밖 별빛.
- 팔레트: 미드나잇 네이비, 플럼, 은은한 로즈 골드.
- 의상: 세련되고 완전히 착용된 짙은 플럼 블라우스. 노출/성적 묘사 금지.
- 프레이밍: 얼굴과 어깨 중심의 인물 사진. 메인 웹 카드에 쓸 세로형 크롭에서도 얼굴이 중앙 안전영역 안에 남도록 구성. 배너용은 인물을 오른쪽 1/3에 두고 왼쪽에 텍스트용 여백을 둔다.
- 글자, 워터마크, 로고는 이미지 안에 넣지 않는다.

## 생성 결과물

1. **Featured 이미지**: `luna-featured.webp` — 4:5 세로 포트레이트, 권장 1200×1500 이상, 웹 최적화.
2. **Featured 배너**: `luna-banner.webp` — 16:9 또는 2:1 가로 배너, 권장 1600×900 이상. 같은 캐릭터 외형과 팔레트를 유지한다.
3. **짧은 영상**: `luna-featured-loop.mp4` — 5–8초, 세로 4:5 (또는 제공되는 경우 9:16), 무음 또는 별도 권리 확인된 오디오만 사용. 인물 정체성과 얼굴 형태가 프레임마다 일관되어야 한다.
4. 영상에서 자연스러운 미세 동작만 사용: 천천히 숨 쉬기, 한 번 자연스럽게 눈 깜빡이기, 아주 살짝 미소 짓기, 머리카락/커튼의 약한 바람 움직임, 배경의 작은 조명/별빛 반짝임. 카메라 움직임은 거의 없는 부드러운 느린 푸시인.
5. 정지/마지막 프레임이 시작 프레임과 자연스럽게 연결되는 루프를 만든다. 얼굴 변형, 과장된 표정, 급격한 카메라 이동은 피한다.

## 제안 프롬프트 — 이미지

> Original photorealistic cinematic editorial portrait of Luna, a fictional 23-year-old adult digital illustrator. Warm, gentle, quietly expression, natural dark brown hair, subtle makeup, wearing a tasteful fully-clothed dark plum blouse. Cozy artist's studio at blue hour, soft moonlight through the window, softly blurred canvases and warm fairy lights, delicate stars outside. Authentic skin texture, natural facial proportions, elegant and inviting, midnight navy and plum with restrained rose-gold highlights, shallow depth of field, premium character-card photography. Head-and-shoulders portrait, face centered within a vertical 4:5 safe crop, no text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit.

## 제안 프롬프트 — 배너

> Wide cinematic photorealistic editorial banner in the same scene and exact character design as Luna's portrait: fictional 23-year-old adult digital illustrator in a cozy blue-hour art studio, fully clothed dark plum blouse, moonlit window and soft starfield. Place Luna on the right third; preserve generous clean dark negative space on the left for website headline overlay. Midnight navy/plum palette, restrained rose-gold practical lights, natural skin, consistent facial identity, no text, no logo, no watermark, 16:9.

## 제안 프롬프트 — 이미지-투-비디오

> Animate the supplied Luna portrait as a subtle premium character-card loop. Preserve her identity, face, clothing, composition, and lighting exactly. Over 6 seconds she breathes naturally, blinks once, and forms a very slight warm smile. A few strands of hair and the curtain move gently in a faint night breeze; distant fairy lights and stars softly shimmer. Add only a very slow, nearly imperceptible camera push-in. Stable face and hands, no morphing, no new objects, no cuts, no speech, no text, no watermark. Seamless loop, cinematic photorealism, fully clothed adult fictional character.

## 네거티브 프롬프트

> minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts.

## 출력 / 전달

- Open Design에서 결과를 생성한 후 아래 경로 내보내거나 프로젝트 담당자에게 전달한다:
  - `privseai-trystero/public/images/luna-featured.webp`
  - `privseai-trystero/public/images/luna-banner.webp`
  - `privseai-trystero/public/videos/luna-featured-loop.mp4`
- 파일을 사이트에 반영할 때 `src/data/candyPresets.ts`에서 Luna의 `avatarUrl`을 `/images/luna-featured.webp`, `bannerUrl`을 `/images/luna-banner.webp`로 바꾼다.
- 영상은 현재 정적 캐릭터 카드가 직접 재생하도록 연결되어 있지 않다. 영상 파일은 우선 에셋으로 전달하고, 사이트에서 재생하려면 별도 UI 연결 작업을 한다.
- 모든 파일은 실제 생성 결과인지 확인하고, 이미지 미리보기, 크롭, 색감, 성인 캐릭터 여부, loop 재생 상태를 검수한다. 생성되지 않은 결과를 완료로 표시하지 않는다.
