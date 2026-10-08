# OPEN-DESIGN-PROMPT-PACK — PrivseAI 갤러리 100장 · 배너 6장 · 루프 영상

> 단일 소스: [`OPEN-DESIGN-SHOTLIST.json`](./OPEN-DESIGN-SHOTLIST.json) · 빌드: `node scripts/generate-shot-assets.mjs`
> 원본 아트 디렉션: [`OPEN-DESIGN-IMAGE-VIDEO-BRIEF.md`](./OPEN-DESIGN-IMAGE-VIDEO-BRIEF.md)

## 1. 개요

| 항목 | 값 |
|---|---|
| 갤러리 촬영 | **100장** (4:5 세로, 갤러리 카드용) |
| 분포 | Luna 30 · Mia 18 · Yuki 18 · Sophia 12 · Asuka 12 · Leo 10 |
| 배너 | 6장 (캐릭터별 16:9, 인물 우측 1/3 · 좌측 헤드라인 여백) |
| 영상 | Luna 6초 루프 (브리프의 이미지-투-비디오 프롬프트 그대로 사용) |
| 스타일 모드 | `photo` = Luna · Mia · Sophia · Leo / `anime` = Yuki · Asuka |
| 안전 기준 | 전 촬영 **완전 착용 · 비explicit** (성인 가상 캐릭터) |

**모드 판정 근거**: `candyPresets.ts`의 `category` 필드 (`"realistic"` → photo, `"anime"` → anime).
Yuki는 현재 스톡 사진이 실사지만 `category: "anime"`이므로, 이번 확장부터는 애니메이션 캐릭터카드 렌더로 통일합니다. Asuka도 동일.

## 2. 프롬프트 조립 규칙

```
PROMPT   = LOCK[캐릭터] + " " + SCENE[씬코드].en + ", " + ACTION + ". " + FRAME[CU|MS] + " " + SUFFIX[모드]
NEGATIVE = NEGATIVES[모드]          ← 모든 촬영에 공통 1회 첨부
```

직접 붙여넣기를 원하면 §7의 촬영별 블록을 그대로 복사하세요 (프롬프트 + 네거티브 포함).
대량 생성은 `node scripts/generate-shot-assets.mjs`로 갤러리 패치와 대기 에셋을 함께 관리합니다.

## 3. Identity Locks (생성 시 반드시 선두에 붙일 문단)

**Luna** (`photo`)
```
Original photorealistic cinematic editorial portrait of Luna, a fictional 23-year-old adult digital illustrator. Long natural dark-brown hair, soft hazel eyes, subtle makeup, warm gentle quietly romantic expression. Fully clothed in a tasteful dark plum blouse (wardrobe may shift per scene - knit blanket, loose cream shirt - always fully covered). Blue-hour atelier world: midnight navy, plum, restrained rose-gold highlights.
```

**Mia** (`photo`)
```
Original photorealistic cinematic editorial portrait of Mia, a fictional 24-year-old adult fitness coach. Sun-kissed skin, light-brown high ponytail, bright confident direct smile, athletic build. Always fully clothed in stylish full-coverage athletic wear (long-sleeve top, full-length leggings, zip jacket as the scene allows). Fresh dawn blues, warm sand, coral accents, clean daylight.
```

**Yuki** (`anime`)
```
Original premium anime illustration of Yuki, a fictional 21-year-old adult VTuber and gaming streamer. Silver-lavender long twin tails, violet eyes, tsundere charm - flustered yet playful expressions. Always fully dressed in an oversized cozy gaming hoodie or cute fully-covered loungewear, with her signature cat-ear headband. Neon gaming-room world: electric pink and cyan, monitor glow, soft night ambience.
```

**Sophia** (`photo`)
```
Original photorealistic cinematic editorial portrait of Sophia, a fictional 27-year-old adult art curator. Sleek dark bob, refined bone structure, calm knowing gaze, understated elegance. Fully clothed in a tailored silk midi dress with a thin gold necklace. Gallery world: ink-blues, warm museum amber, champagne neutrals.
```

**Asuka** (`anime`)
```
Original premium anime illustration of Asuka, a fictional 22-year-old adult cyber-ninja infiltration specialist in Neo-Tokyo. Asymmetric crimson-streaked black hair, sharp amber eyes, fierce yet loyal expression. Always in a fully fastened tactical jacket with a high collar. Rain-slick neon world: magenta, cyan, deep indigo, noir night mood.
```

**Leo** (`photo`)
```
Original photorealistic cinematic editorial portrait of Leo, a fictional 28-year-old adult tech CEO. Tousled dark hair, light stubble, warm confident protective expression. Fully dressed in a bespoke charcoal suit (tie loosened only in late-night scenes). City-night steel blues, warm whiskey lamplight, restrained gold.
```

## 4. Scene Library (22개 씬)

| 코드 | 한국어 | English scene block |
|---|---|---|
| A1 | 블루아워 아틀리에 | Cozy artist's studio at blue hour, soft moonlight through the window, softly blurred canvases, warm fairy lights, delicate stars outside |
| A2 | 비 내리는 밤 작업실 | Rainy-night studio, rain streaks on the window, warm lamp glow, knit textures, a wine glass within reach |
| A3 | 창가 별빛 | Moonlit window nook at night, vast starfield outside, sheer curtain, cool navy light with a warm lamp counterpoint |
| A4 | 모닝 커피 스케치 | Soft morning light over the studio desk, steaming coffee, sketchbooks and crayons scattered, pale warm tones |
| A5 | 밤의 재즈와 와인 | Dim night lounge corner, jazz records and wine, rose-gold practical lights, deep plum shadows |
| B1 | 해돋이 비치 워크아웃 | Sunrise beach, wet sand reflecting dawn light, gentle waves, open pastel sky |
| B2 | 브라이트 필라테스 | Bright pilates studio, large mirrors, daylight-flooded white-oak floor, plants, clean minimal energy |
| B3 | 나이트 헬스장 | Late-night gym, mostly empty floor, low moody lighting, rubber flooring and steel equipment |
| B4 | 헬시 칵테일 키친 | Modern kitchen at night, island counter, fresh ingredients and green smoothies, warm task lighting |
| C1 | 네온 게이밍룸 | Neon gaming room, dual-monitor glow, RGB strips, collectible figures, night-dark walls |
| C2 | 코지 스트리밍 소파 | Cozy streaming couch corner, soft blanket, fairy lights, snack table, warm lamp |
| C3 | 심야 야식 라면 | Midnight desk with cup ramen, cluttered keyboard, energy drinks, monitor glow |
| C4 | 콘 미드나잇 로비 | Convention lobby at midnight, abstract event banners, elevators and patterned carpet glow |
| D1 | 갤러리 이브닝 | Upscale contemporary gallery, track lighting, large abstract canvases, polished concrete floor |
| D2 | 와인 셀러 & 서재 | Private wine cellar and library, oak barrels, tall bookshelves, candle-warm amber light |
| D3 | 피아노 룸나이트 | Night music room with a grand piano, heavy curtains, a single warm spotlight |
| E1 | 네온 골목 스텔스 | Rain-slick Neo-Tokyo alley, towering neon signage, steam vents, cyan-magenta reflections |
| E2 | 세이프하우스 휴식 | Underground safehouse, crates and cabling, a single hanging bulb, humming monitors |
| E3 | 메가시티 옥상 | Megacity rooftop at night, endless skyline of holographic towers, wind-swept air |
| F1 | 펜트하우스 스카이라이트 | Penthouse floor-to-ceiling window, city skyline lights below, champagne on the table |
| F2 | 심야 오피스 | Late-night corner office, stacked reports, skyline through glass, desk-lamp pools of light |
| F3 | 주말 세일링 | Weekend sailing yacht deck, open sea, taut sails, golden afternoon light |

## 5. Framing · Suffix · Negatives

**FRAME — CU**
```
Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop
```

**FRAME — MS**
```
Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition
```

**SUFFIX — photo**
```
Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

**SUFFIX — anime**
```
Clean lineart, soft cel shading, gentle rim light, premium anime character-card illustration. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

**NEGATIVE — photo**
```
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

**NEGATIVE — anime**
```
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, photorealistic, 3d render, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

## 6. 배너 프롬프트 (6장 · 16:9)

**luna-banner** — Luna 아틀리에 (브리프 원문 유지)
```
Wide cinematic photorealistic editorial banner in the same scene and exact character design as Luna's portrait: fictional 23-year-old adult digital illustrator in a cozy blue-hour art studio, fully clothed dark plum blouse, moonlit window and soft starfield. Place Luna on the right third; preserve generous clean dark negative space on the left for website headline overlay. Midnight navy/plum palette, restrained rose-gold practical lights, natural skin, consistent facial identity, fictional adult character, fully clothed, non-explicit, no text, no logo, no watermark, 16:9.
```

**mia-banner** — Mia 해돋이 비치
```
Wide cinematic photorealistic editorial banner in the same scene and exact character design as Mia's portrait: fictional 24-year-old adult fitness coach on a sunrise beach in full-coverage athletic wear, wet sand and gentle waves behind her. Place Mia on the right third; preserve clean pastel-sky negative space on the left for website headline overlay. Dawn blues, warm sand and coral accents, natural skin, consistent facial identity, fictional adult character, fully clothed, non-explicit, no text, no logo, no watermark, 16:9.
```

**yuki-banner** — Yuki 네온 게이밍룸 (anime)
```
Wide premium anime illustration banner in the same scene and exact character design as Yuki's portrait: fictional 21-year-old adult VTuber in her neon gaming room, headset on, dual-monitor glow, collectible figures softly out of focus. Place Yuki on the right third; preserve dark neon negative space on the left for website headline overlay. Electric pink and cyan palette, consistent character design, fictional adult character, fully clothed, non-explicit, no text, no logo, no watermark, 16:9.
```

**sophia-banner** — Sophia 갤러리 이브닝
```
Wide cinematic photorealistic editorial banner in the same scene and exact character design as Sophia's portrait: fictional 27-year-old adult art curator in an upscale night gallery, large abstract canvases under track lighting. Place Sophia on the right third; preserve deep ink-blue negative space on the left for website headline overlay. Museum amber and champagne neutrals, natural skin, consistent facial identity, fictional adult character, fully clothed, non-explicit, no text, no logo, no watermark, 16:9.
```

**asuka-banner** — Asuka 네온 골목 (anime)
```
Wide premium anime illustration banner in the same scene and exact character design as Asuka's portrait: fictional 22-year-old adult cyber-ninja in a rain-slick Neo-Tokyo alley, towering neon signage, steam vents. Place Asuka on the right third; preserve dark indigo negative space on the left for website headline overlay. Magenta and cyan neon rim light, consistent character design, fictional adult character, fully clothed, non-explicit, no text, no logo, no watermark, 16:9.
```

**leo-banner** — Leo 펜트하우스 스카이라인
```
Wide cinematic photorealistic editorial banner in the same scene and exact character design as Leo's portrait: fictional 28-year-old adult tech CEO in a bespoke charcoal suit beside a penthouse floor-to-ceiling window, city skyline lights below. Place Leo on the right third; preserve deep night-sky negative space on the left for website headline overlay. Steel blues and warm whiskey lamplight, natural skin, consistent facial identity, fictional adult character, fully clothed, non-explicit, no text, no logo, no watermark, 16:9.
```

## 7. 100장 촬영 프롬프트

각 블록 = 촬영 메타 + 완성 프롬프트 + 공통 네거티브. `<!-- SHOT-TABLE -->

### luna-01 · 블루아워 아틀리에 (A1) · 클로즈업 · stage 0 · 첫 붓질의 눈길

```prompt
Original photorealistic cinematic editorial portrait of Luna, a fictional 23-year-old adult digital illustrator. Long natural dark-brown hair, soft hazel eyes, subtle makeup, warm gentle quietly romantic expression. Fully clothed in a tasteful dark plum blouse (wardrobe may shift per scene - knit blanket, loose cream shirt - always fully covered). Blue-hour atelier world: midnight navy, plum, restrained rose-gold highlights. Cozy artist's studio at blue hour, soft moonlight through the window, softly blurred canvases, warm fairy lights, delicate stars outside, she glances up from the canvas, brush poised mid-stroke, soft knowing smile. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### luna-02 · 블루아워 아틀리에 (A1) · 미디엄 · stage 0 · 캔버스를 팔끝으로 감상

```prompt
Original photorealistic cinematic editorial portrait of Luna, a fictional 23-year-old adult digital illustrator. Long natural dark-brown hair, soft hazel eyes, subtle makeup, warm gentle quietly romantic expression. Fully clothed in a tasteful dark plum blouse (wardrobe may shift per scene - knit blanket, loose cream shirt - always fully covered). Blue-hour atelier world: midnight navy, plum, restrained rose-gold highlights. Cozy artist's studio at blue hour, soft moonlight through the window, softly blurred canvases, warm fairy lights, delicate stars outside, she leans back at arm's length to judge the canvas, head tilted. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### luna-03 · 블루아워 아틀리에 (A1) · 클로즈업 · stage 1 · 플럼 안료 배합

```prompt
Original photorealistic cinematic editorial portrait of Luna, a fictional 23-year-old adult digital illustrator. Long natural dark-brown hair, soft hazel eyes, subtle makeup, warm gentle quietly romantic expression. Fully clothed in a tasteful dark plum blouse (wardrobe may shift per scene - knit blanket, loose cream shirt - always fully covered). Blue-hour atelier world: midnight navy, plum, restrained rose-gold highlights. Cozy artist's studio at blue hour, soft moonlight through the window, softly blurred canvases, warm fairy lights, delicate stars outside, she mixes plum pigment on a glass palette, eyes flicking to her reference. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### luna-04 · 블루아워 아틀리에 (A1) · 클로즈업 · stage 1 · 달빛이 스민 뺨

```prompt
Original photorealistic cinematic editorial portrait of Luna, a fictional 23-year-old adult digital illustrator. Long natural dark-brown hair, soft hazel eyes, subtle makeup, warm gentle quietly romantic expression. Fully clothed in a tasteful dark plum blouse (wardrobe may shift per scene - knit blanket, loose cream shirt - always fully covered). Blue-hour atelier world: midnight navy, plum, restrained rose-gold highlights. Cozy artist's studio at blue hour, soft moonlight through the window, softly blurred canvases, warm fairy lights, delicate stars outside, she turns toward the window as moonlight catches her cheekbones, serene. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### luna-05 · 블루아워 아틀리에 (A1) · 미디엄 · stage 2 · 램프 아래 아이디어 스케치

```prompt
Original photorealistic cinematic editorial portrait of Luna, a fictional 23-year-old adult digital illustrator. Long natural dark-brown hair, soft hazel eyes, subtle makeup, warm gentle quietly romantic expression. Fully clothed in a tasteful dark plum blouse (wardrobe may shift per scene - knit blanket, loose cream shirt - always fully covered). Blue-hour atelier world: midnight navy, plum, restrained rose-gold highlights. Cozy artist's studio at blue hour, soft moonlight through the window, softly blurred canvases, warm fairy lights, delicate stars outside, she sketches ideas in a notebook under a warm desk lamp, focused. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### luna-06 · 블루아워 아틀리에 (A1) · 클로즈업 · stage 2 · 어깨 너머 돌아보기

```prompt
Original photorealistic cinematic editorial portrait of Luna, a fictional 23-year-old adult digital illustrator. Long natural dark-brown hair, soft hazel eyes, subtle makeup, warm gentle quietly romantic expression. Fully clothed in a tasteful dark plum blouse (wardrobe may shift per scene - knit blanket, loose cream shirt - always fully covered). Blue-hour atelier world: midnight navy, plum, restrained rose-gold highlights. Cozy artist's studio at blue hour, soft moonlight through the window, softly blurred canvases, warm fairy lights, delicate stars outside, she glances back over her shoulder with a half-smile, hair slipping forward. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### luna-07 · 블루아워 아틀리에 (A1) · 클로즈업 · stage 3 · 뺨에 묻은 물감 자국

```prompt
Original photorealistic cinematic editorial portrait of Luna, a fictional 23-year-old adult digital illustrator. Long natural dark-brown hair, soft hazel eyes, subtle makeup, warm gentle quietly romantic expression. Fully clothed in a tasteful dark plum blouse (wardrobe may shift per scene - knit blanket, loose cream shirt - always fully covered). Blue-hour atelier world: midnight navy, plum, restrained rose-gold highlights. Cozy artist's studio at blue hour, soft moonlight through the window, softly blurred canvases, warm fairy lights, delicate stars outside, she smiles tiredly, a small smudge of plum paint on her cheek. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### luna-08 · 블루아워 아틀리에 (A1) · 미디엄 · stage 4 · 완성작 옆의 조용한 자부심

```prompt
Original photorealistic cinematic editorial portrait of Luna, a fictional 23-year-old adult digital illustrator. Long natural dark-brown hair, soft hazel eyes, subtle makeup, warm gentle quietly romantic expression. Fully clothed in a tasteful dark plum blouse (wardrobe may shift per scene - knit blanket, loose cream shirt - always fully covered). Blue-hour atelier world: midnight navy, plum, restrained rose-gold highlights. Cozy artist's studio at blue hour, soft moonlight through the window, softly blurred canvases, warm fairy lights, delicate stars outside, she stands beside her finished canvas, arms relaxed, quiet pride in her expression. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### luna-09 · 비 내리는 밤 작업실 (A2) · 클로즈업 · stage 1 · 빗방울을 세는 창가

```prompt
Original photorealistic cinematic editorial portrait of Luna, a fictional 23-year-old adult digital illustrator. Long natural dark-brown hair, soft hazel eyes, subtle makeup, warm gentle quietly romantic expression. Fully clothed in a tasteful dark plum blouse (wardrobe may shift per scene - knit blanket, loose cream shirt - always fully covered). Blue-hour atelier world: midnight navy, plum, restrained rose-gold highlights. Rainy-night studio, rain streaks on the window, warm lamp glow, knit textures, a wine glass within reach, she watches rain trails down the window, chin resting on her hand. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### luna-10 · 비 내리는 밤 작업실 (A2) · 미디엄 · stage 1 · 담요와 따뜻한 머그

```prompt
Original photorealistic cinematic editorial portrait of Luna, a fictional 23-year-old adult digital illustrator. Long natural dark-brown hair, soft hazel eyes, subtle makeup, warm gentle quietly romantic expression. Fully clothed in a tasteful dark plum blouse (wardrobe may shift per scene - knit blanket, loose cream shirt - always fully covered). Blue-hour atelier world: midnight navy, plum, restrained rose-gold highlights. Rainy-night studio, rain streaks on the window, warm lamp glow, knit textures, a wine glass within reach, she wraps herself in a knit blanket, cradling a warm mug with both hands. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### luna-11 · 비 내리는 밤 작업실 (A2) · 클로즈업 · stage 2 · 빗소리에 눈 감기

```prompt
Original photorealistic cinematic editorial portrait of Luna, a fictional 23-year-old adult digital illustrator. Long natural dark-brown hair, soft hazel eyes, subtle makeup, warm gentle quietly romantic expression. Fully clothed in a tasteful dark plum blouse (wardrobe may shift per scene - knit blanket, loose cream shirt - always fully covered). Blue-hour atelier world: midnight navy, plum, restrained rose-gold highlights. Rainy-night studio, rain streaks on the window, warm lamp glow, knit textures, a wine glass within reach, she listens to the rain with her eyes closed, utterly at peace. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### luna-12 · 비 내리는 밤 작업실 (A2) · 미디엄 · stage 2 · 창가 와인 한 잔

```prompt
Original photorealistic cinematic editorial portrait of Luna, a fictional 23-year-old adult digital illustrator. Long natural dark-brown hair, soft hazel eyes, subtle makeup, warm gentle quietly romantic expression. Fully clothed in a tasteful dark plum blouse (wardrobe may shift per scene - knit blanket, loose cream shirt - always fully covered). Blue-hour atelier world: midnight navy, plum, restrained rose-gold highlights. Rainy-night studio, rain streaks on the window, warm lamp glow, knit textures, a wine glass within reach, she holds a wine glass by the rain-streaked window, soft laughter fading. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### luna-13 · 비 내리는 밤 작업실 (A2) · 클로즈업 · stage 3 · 스케치북에 담는 빗소리

```prompt
Original photorealistic cinematic editorial portrait of Luna, a fictional 23-year-old adult digital illustrator. Long natural dark-brown hair, soft hazel eyes, subtle makeup, warm gentle quietly romantic expression. Fully clothed in a tasteful dark plum blouse (wardrobe may shift per scene - knit blanket, loose cream shirt - always fully covered). Blue-hour atelier world: midnight navy, plum, restrained rose-gold highlights. Rainy-night studio, rain streaks on the window, warm lamp glow, knit textures, a wine glass within reach, she doodles rain patterns in a sketchbook, seen just above her shoulder. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### luna-14 · 비 내리는 밤 작업실 (A2) · 클로즈업 · stage 4 · 램프 불빛에 잠든 오후

```prompt
Original photorealistic cinematic editorial portrait of Luna, a fictional 23-year-old adult digital illustrator. Long natural dark-brown hair, soft hazel eyes, subtle makeup, warm gentle quietly romantic expression. Fully clothed in a tasteful dark plum blouse (wardrobe may shift per scene - knit blanket, loose cream shirt - always fully covered). Blue-hour atelier world: midnight navy, plum, restrained rose-gold highlights. Rainy-night studio, rain streaks on the window, warm lamp glow, knit textures, a wine glass within reach, she dozes in a pool of warm lamp light, blanket pulled high. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### luna-15 · 창가 별빛 (A3) · 클로즈업 · stage 0 · 별을 세는 손가락

```prompt
Original photorealistic cinematic editorial portrait of Luna, a fictional 23-year-old adult digital illustrator. Long natural dark-brown hair, soft hazel eyes, subtle makeup, warm gentle quietly romantic expression. Fully clothed in a tasteful dark plum blouse (wardrobe may shift per scene - knit blanket, loose cream shirt - always fully covered). Blue-hour atelier world: midnight navy, plum, restrained rose-gold highlights. Moonlit window nook at night, vast starfield outside, sheer curtain, cool navy light with a warm lamp counterpoint, she counts stars, fingertip pressed lightly to the cold glass. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### luna-16 · 창가 별빛 (A3) · 클로즈업 · stage 1 · 달빛으로 그린 옆모습

```prompt
Original photorealistic cinematic editorial portrait of Luna, a fictional 23-year-old adult digital illustrator. Long natural dark-brown hair, soft hazel eyes, subtle makeup, warm gentle quietly romantic expression. Fully clothed in a tasteful dark plum blouse (wardrobe may shift per scene - knit blanket, loose cream shirt - always fully covered). Blue-hour atelier world: midnight navy, plum, restrained rose-gold highlights. Moonlit window nook at night, vast starfield outside, sheer curtain, cool navy light with a warm lamp counterpoint, her profile is edged by moonlight as she gazes outside. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### luna-17 · 창가 별빛 (A3) · 클로즈업 · stage 2 · 차가운 유리에 이마를

```prompt
Original photorealistic cinematic editorial portrait of Luna, a fictional 23-year-old adult digital illustrator. Long natural dark-brown hair, soft hazel eyes, subtle makeup, warm gentle quietly romantic expression. Fully clothed in a tasteful dark plum blouse (wardrobe may shift per scene - knit blanket, loose cream shirt - always fully covered). Blue-hour atelier world: midnight navy, plum, restrained rose-gold highlights. Moonlit window nook at night, vast starfield outside, sheer curtain, cool navy light with a warm lamp counterpoint, she rests her forehead against the cool window, breath fogging the pane. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### luna-18 · 창가 별빛 (A3) · 미디엄 · stage 2 · 작은 망원경

```prompt
Original photorealistic cinematic editorial portrait of Luna, a fictional 23-year-old adult digital illustrator. Long natural dark-brown hair, soft hazel eyes, subtle makeup, warm gentle quietly romantic expression. Fully clothed in a tasteful dark plum blouse (wardrobe may shift per scene - knit blanket, loose cream shirt - always fully covered). Blue-hour atelier world: midnight navy, plum, restrained rose-gold highlights. Moonlit window nook at night, vast starfield outside, sheer curtain, cool navy light with a warm lamp counterpoint, she aims a small telescope at the sky, one eye closed. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### luna-19 · 창가 별빛 (A3) · 미디엄 · stage 3 · 별빛 액자 옆 포즈

```prompt
Original photorealistic cinematic editorial portrait of Luna, a fictional 23-year-old adult digital illustrator. Long natural dark-brown hair, soft hazel eyes, subtle makeup, warm gentle quietly romantic expression. Fully clothed in a tasteful dark plum blouse (wardrobe may shift per scene - knit blanket, loose cream shirt - always fully covered). Blue-hour atelier world: midnight navy, plum, restrained rose-gold highlights. Moonlit window nook at night, vast starfield outside, sheer curtain, cool navy light with a warm lamp counterpoint, she poses beside her framed starfield sketch, arms loosely crossed. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### luna-20 · 창가 별빛 (A3) · 미디엄 · stage 4 · 창가 의자에 웅크리기

```prompt
Original photorealistic cinematic editorial portrait of Luna, a fictional 23-year-old adult digital illustrator. Long natural dark-brown hair, soft hazel eyes, subtle makeup, warm gentle quietly romantic expression. Fully clothed in a tasteful dark plum blouse (wardrobe may shift per scene - knit blanket, loose cream shirt - always fully covered). Blue-hour atelier world: midnight navy, plum, restrained rose-gold highlights. Moonlit window nook at night, vast starfield outside, sheer curtain, cool navy light with a warm lamp counterpoint, she curls up on the window chair with knees drawn to her chest. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### luna-21 · 모닝 커피 스케치 (A4) · 클로즈업 · stage 0 · 모닝 커피의 눈

```prompt
Original photorealistic cinematic editorial portrait of Luna, a fictional 23-year-old adult digital illustrator. Long natural dark-brown hair, soft hazel eyes, subtle makeup, warm gentle quietly romantic expression. Fully clothed in a tasteful dark plum blouse (wardrobe may shift per scene - knit blanket, loose cream shirt - always fully covered). Blue-hour atelier world: midnight navy, plum, restrained rose-gold highlights. Soft morning light over the studio desk, steaming coffee, sketchbooks and crayons scattered, pale warm tones, she cradles a coffee mug in soft morning light, eyes still sleepy. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### luna-22 · 모닝 커피 스케치 (A4) · 미디엄 · stage 1 · 느슨한 셔츠의 아침 스케치

```prompt
Original photorealistic cinematic editorial portrait of Luna, a fictional 23-year-old adult digital illustrator. Long natural dark-brown hair, soft hazel eyes, subtle makeup, warm gentle quietly romantic expression. Fully clothed in a tasteful dark plum blouse (wardrobe may shift per scene - knit blanket, loose cream shirt - always fully covered). Blue-hour atelier world: midnight navy, plum, restrained rose-gold highlights. Soft morning light over the studio desk, steaming coffee, sketchbooks and crayons scattered, pale warm tones, she sketches at her desk in a loose cream shirt, morning sun across the table. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### luna-23 · 모닝 커피 스케치 (A4) · 클로즈업 · stage 1 · 크레용을 고르는 손

```prompt
Original photorealistic cinematic editorial portrait of Luna, a fictional 23-year-old adult digital illustrator. Long natural dark-brown hair, soft hazel eyes, subtle makeup, warm gentle quietly romantic expression. Fully clothed in a tasteful dark plum blouse (wardrobe may shift per scene - knit blanket, loose cream shirt - always fully covered). Blue-hour atelier world: midnight navy, plum, restrained rose-gold highlights. Soft morning light over the studio desk, steaming coffee, sketchbooks and crayons scattered, pale warm tones, she selects crayons from a jar, brow furrowed in thought. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### luna-24 · 모닝 커피 스케치 (A4) · 클로즈업 · stage 2 · 김 오르는 컵 너머의 얼굴

```prompt
Original photorealistic cinematic editorial portrait of Luna, a fictional 23-year-old adult digital illustrator. Long natural dark-brown hair, soft hazel eyes, subtle makeup, warm gentle quietly romantic expression. Fully clothed in a tasteful dark plum blouse (wardrobe may shift per scene - knit blanket, loose cream shirt - always fully covered). Blue-hour atelier world: midnight navy, plum, restrained rose-gold highlights. Soft morning light over the studio desk, steaming coffee, sketchbooks and crayons scattered, pale warm tones, her face is framed above rising steam from a fresh cup. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### luna-25 · 모닝 커피 스케치 (A4) · 미디엄 · stage 3 · 레퍼런스 보드에 핀 꽂기

```prompt
Original photorealistic cinematic editorial portrait of Luna, a fictional 23-year-old adult digital illustrator. Long natural dark-brown hair, soft hazel eyes, subtle makeup, warm gentle quietly romantic expression. Fully clothed in a tasteful dark plum blouse (wardrobe may shift per scene - knit blanket, loose cream shirt - always fully covered). Blue-hour atelier world: midnight navy, plum, restrained rose-gold highlights. Soft morning light over the studio desk, steaming coffee, sketchbooks and crayons scattered, pale warm tones, she pins reference photos to a corkboard, reaching on tiptoe. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### luna-26 · 밤의 재즈와 와인 (A5) · 미디엄 · stage 2 · 재즈에 실린 미소

```prompt
Original photorealistic cinematic editorial portrait of Luna, a fictional 23-year-old adult digital illustrator. Long natural dark-brown hair, soft hazel eyes, subtle makeup, warm gentle quietly romantic expression. Fully clothed in a tasteful dark plum blouse (wardrobe may shift per scene - knit blanket, loose cream shirt - always fully covered). Blue-hour atelier world: midnight navy, plum, restrained rose-gold highlights. Dim night lounge corner, jazz records and wine, rose-gold practical lights, deep plum shadows, she sways faintly to the jazz, wine glass loose in her fingers. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### luna-27 · 밤의 재즈와 와인 (A5) · 클로즈업 · stage 2 · 로즈골드 딤라이트 클로즈업

```prompt
Original photorealistic cinematic editorial portrait of Luna, a fictional 23-year-old adult digital illustrator. Long natural dark-brown hair, soft hazel eyes, subtle makeup, warm gentle quietly romantic expression. Fully clothed in a tasteful dark plum blouse (wardrobe may shift per scene - knit blanket, loose cream shirt - always fully covered). Blue-hour atelier world: midnight navy, plum, restrained rose-gold highlights. Dim night lounge corner, jazz records and wine, rose-gold practical lights, deep plum shadows, close portrait under dim rose-gold practical light, mid-conversation warmth. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### luna-28 · 밤의 재즈와 와인 (A5) · 미디엄 · stage 3 · 레코드를 넘기는 손

```prompt
Original photorealistic cinematic editorial portrait of Luna, a fictional 23-year-old adult digital illustrator. Long natural dark-brown hair, soft hazel eyes, subtle makeup, warm gentle quietly romantic expression. Fully clothed in a tasteful dark plum blouse (wardrobe may shift per scene - knit blanket, loose cream shirt - always fully covered). Blue-hour atelier world: midnight navy, plum, restrained rose-gold highlights. Dim night lounge corner, jazz records and wine, rose-gold practical lights, deep plum shadows, she flips through vinyl records, pausing on a sleeve she likes. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### luna-29 · 밤의 재즈와 와인 (A5) · 미디엄 · stage 4 · 두 번째 잔을 건네기

```prompt
Original photorealistic cinematic editorial portrait of Luna, a fictional 23-year-old adult digital illustrator. Long natural dark-brown hair, soft hazel eyes, subtle makeup, warm gentle quietly romantic expression. Fully clothed in a tasteful dark plum blouse (wardrobe may shift per scene - knit blanket, loose cream shirt - always fully covered). Blue-hour atelier world: midnight navy, plum, restrained rose-gold highlights. Dim night lounge corner, jazz records and wine, rose-gold practical lights, deep plum shadows, she sets a second wine glass down toward the camera, inviting smile. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### luna-30 · 밤의 재즈와 와인 (A5) · 클로즈업 · stage 5 · 촛불 사이의 대화

```prompt
Original photorealistic cinematic editorial portrait of Luna, a fictional 23-year-old adult digital illustrator. Long natural dark-brown hair, soft hazel eyes, subtle makeup, warm gentle quietly romantic expression. Fully clothed in a tasteful dark plum blouse (wardrobe may shift per scene - knit blanket, loose cream shirt - always fully covered). Blue-hour atelier world: midnight navy, plum, restrained rose-gold highlights. Dim night lounge corner, jazz records and wine, rose-gold practical lights, deep plum shadows, a candlelit mid-conversation smile, wine breathing beside her. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### mia-01 · 해돋이 비치 워크아웃 (B1) · 미디엄 · stage 0 · 일출 스트레칭

```prompt
Original photorealistic cinematic editorial portrait of Mia, a fictional 24-year-old adult fitness coach. Sun-kissed skin, light-brown high ponytail, bright confident direct smile, athletic build. Always fully clothed in stylish full-coverage athletic wear (long-sleeve top, full-length leggings, zip jacket as the scene allows). Fresh dawn blues, warm sand, coral accents, clean daylight. Sunrise beach, wet sand reflecting dawn light, gentle waves, open pastel sky, she holds a sunrise hamstring stretch on wet sand, hair loose. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### mia-02 · 해돋이 비치 워크아웃 (B1) · 미디엄 · stage 1 · 조깅 멈춤의 호흡

```prompt
Original photorealistic cinematic editorial portrait of Mia, a fictional 24-year-old adult fitness coach. Sun-kissed skin, light-brown high ponytail, bright confident direct smile, athletic build. Always fully clothed in stylish full-coverage athletic wear (long-sleeve top, full-length leggings, zip jacket as the scene allows). Fresh dawn blues, warm sand, coral accents, clean daylight. Sunrise beach, wet sand reflecting dawn light, gentle waves, open pastel sky, she pauses mid-jog with hands on hips, breathing deep, waves behind her. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### mia-03 · 해돋이 비치 워크아웃 (B1) · 미디엄 · stage 1 · 모래 위 런지 자세

```prompt
Original photorealistic cinematic editorial portrait of Mia, a fictional 24-year-old adult fitness coach. Sun-kissed skin, light-brown high ponytail, bright confident direct smile, athletic build. Always fully clothed in stylish full-coverage athletic wear (long-sleeve top, full-length leggings, zip jacket as the scene allows). Fresh dawn blues, warm sand, coral accents, clean daylight. Sunrise beach, wet sand reflecting dawn light, gentle waves, open pastel sky, she holds a controlled beach lunge in a full-coverage athletic set. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### mia-04 · 해돋이 비치 워크아웃 (B1) · 클로즈업 · stage 2 · 수건과 자신감 있는 미소

```prompt
Original photorealistic cinematic editorial portrait of Mia, a fictional 24-year-old adult fitness coach. Sun-kissed skin, light-brown high ponytail, bright confident direct smile, athletic build. Always fully clothed in stylish full-coverage athletic wear (long-sleeve top, full-length leggings, zip jacket as the scene allows). Fresh dawn blues, warm sand, coral accents, clean daylight. Sunrise beach, wet sand reflecting dawn light, gentle waves, open pastel sky, she drops a towel over her shoulder and grins at the camera. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### mia-05 · 해돋이 비치 워크아웃 (B1) · 미디엄 · stage 3 · 모래사장 물 마시기

```prompt
Original photorealistic cinematic editorial portrait of Mia, a fictional 24-year-old adult fitness coach. Sun-kissed skin, light-brown high ponytail, bright confident direct smile, athletic build. Always fully clothed in stylish full-coverage athletic wear (long-sleeve top, full-length leggings, zip jacket as the scene allows). Fresh dawn blues, warm sand, coral accents, clean daylight. Sunrise beach, wet sand reflecting dawn light, gentle waves, open pastel sky, she sits on the sand drinking from a water bottle, legs folded. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### mia-06 · 브라이트 필라테스 (B2) · 미디엄 · stage 0 · 매트 위 리포즈

```prompt
Original photorealistic cinematic editorial portrait of Mia, a fictional 24-year-old adult fitness coach. Sun-kissed skin, light-brown high ponytail, bright confident direct smile, athletic build. Always fully clothed in stylish full-coverage athletic wear (long-sleeve top, full-length leggings, zip jacket as the scene allows). Fresh dawn blues, warm sand, coral accents, clean daylight. Bright pilates studio, large mirrors, daylight-flooded white-oak floor, plants, clean minimal energy, she resets her posture on the mat, hair tied back, focused. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### mia-07 · 브라이트 필라테스 (B2) · 미디엄 · stage 1 · 폼롤러 케어

```prompt
Original photorealistic cinematic editorial portrait of Mia, a fictional 24-year-old adult fitness coach. Sun-kissed skin, light-brown high ponytail, bright confident direct smile, athletic build. Always fully clothed in stylish full-coverage athletic wear (long-sleeve top, full-length leggings, zip jacket as the scene allows). Fresh dawn blues, warm sand, coral accents, clean daylight. Bright pilates studio, large mirrors, daylight-flooded white-oak floor, plants, clean minimal energy, she rolls out her calves with a foam roller, wincing playfully. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### mia-08 · 브라이트 필라테스 (B2) · 미디엄 · stage 2 · 거울 앞 자세 점검

```prompt
Original photorealistic cinematic editorial portrait of Mia, a fictional 24-year-old adult fitness coach. Sun-kissed skin, light-brown high ponytail, bright confident direct smile, athletic build. Always fully clothed in stylish full-coverage athletic wear (long-sleeve top, full-length leggings, zip jacket as the scene allows). Fresh dawn blues, warm sand, coral accents, clean daylight. Bright pilates studio, large mirrors, daylight-flooded white-oak floor, plants, clean minimal energy, she checks her form in the studio mirror, hands on her waist. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### mia-09 · 브라이트 필라테스 (B2) · 클로즈업 · stage 2 · 밴드 운동 중 웃음

```prompt
Original photorealistic cinematic editorial portrait of Mia, a fictional 24-year-old adult fitness coach. Sun-kissed skin, light-brown high ponytail, bright confident direct smile, athletic build. Always fully clothed in stylish full-coverage athletic wear (long-sleeve top, full-length leggings, zip jacket as the scene allows). Fresh dawn blues, warm sand, coral accents, clean daylight. Bright pilates studio, large mirrors, daylight-flooded white-oak floor, plants, clean minimal energy, she laughs mid-pull on a resistance band, bright energy. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### mia-10 · 브라이트 필라테스 (B2) · 클로즈업 · stage 3 · 세션 후 이마 닦기

```prompt
Original photorealistic cinematic editorial portrait of Mia, a fictional 24-year-old adult fitness coach. Sun-kissed skin, light-brown high ponytail, bright confident direct smile, athletic build. Always fully clothed in stylish full-coverage athletic wear (long-sleeve top, full-length leggings, zip jacket as the scene allows). Fresh dawn blues, warm sand, coral accents, clean daylight. Bright pilates studio, large mirrors, daylight-flooded white-oak floor, plants, clean minimal energy, she wipes her forehead with a towel, post-session glow, bright smile. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### mia-11 · 나이트 헬스장 (B3) · 미디엄 · stage 1 · 빈 헬스장 크로스암

```prompt
Original photorealistic cinematic editorial portrait of Mia, a fictional 24-year-old adult fitness coach. Sun-kissed skin, light-brown high ponytail, bright confident direct smile, athletic build. Always fully clothed in stylish full-coverage athletic wear (long-sleeve top, full-length leggings, zip jacket as the scene allows). Fresh dawn blues, warm sand, coral accents, clean daylight. Late-night gym, mostly empty floor, low moody lighting, rubber flooring and steel equipment, she stands on the empty gym floor with arms crossed, confident. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### mia-12 · 나이트 헬스장 (B3) · 미디엄 · stage 2 · 케틀벨 준비 자세

```prompt
Original photorealistic cinematic editorial portrait of Mia, a fictional 24-year-old adult fitness coach. Sun-kissed skin, light-brown high ponytail, bright confident direct smile, athletic build. Always fully clothed in stylish full-coverage athletic wear (long-sleeve top, full-length leggings, zip jacket as the scene allows). Fresh dawn blues, warm sand, coral accents, clean daylight. Late-night gym, mostly empty floor, low moody lighting, rubber flooring and steel equipment, she sets up a kettlebell hinge, zip jacket on, eyes forward. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### mia-13 · 나이트 헬스장 (B3) · 미디엄 · stage 3 · 벤치에서의 휴식

```prompt
Original photorealistic cinematic editorial portrait of Mia, a fictional 24-year-old adult fitness coach. Sun-kissed skin, light-brown high ponytail, bright confident direct smile, athletic build. Always fully clothed in stylish full-coverage athletic wear (long-sleeve top, full-length leggings, zip jacket as the scene allows). Fresh dawn blues, warm sand, coral accents, clean daylight. Late-night gym, mostly empty floor, low moody lighting, rubber flooring and steel equipment, she rests on a bench between sets, water bottle in hand. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### mia-14 · 나이트 헬스장 (B3) · 클로즈업 · stage 4 · 낮은 조명의 클로즈업

```prompt
Original photorealistic cinematic editorial portrait of Mia, a fictional 24-year-old adult fitness coach. Sun-kissed skin, light-brown high ponytail, bright confident direct smile, athletic build. Always fully clothed in stylish full-coverage athletic wear (long-sleeve top, full-length leggings, zip jacket as the scene allows). Fresh dawn blues, warm sand, coral accents, clean daylight. Late-night gym, mostly empty floor, low moody lighting, rubber flooring and steel equipment, close portrait under low gym lighting, breath still catching. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### mia-15 · 헬시 칵테일 키친 (B4) · 미디엄 · stage 2 · 아일랜드에 기댄 스무디

```prompt
Original photorealistic cinematic editorial portrait of Mia, a fictional 24-year-old adult fitness coach. Sun-kissed skin, light-brown high ponytail, bright confident direct smile, athletic build. Always fully clothed in stylish full-coverage athletic wear (long-sleeve top, full-length leggings, zip jacket as the scene allows). Fresh dawn blues, warm sand, coral accents, clean daylight. Modern kitchen at night, island counter, fresh ingredients and green smoothies, warm task lighting, she leans on the kitchen island with a green smoothie, casual. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### mia-16 · 헬시 칵테일 키친 (B4) · 클로즈업 · stage 3 · 카빙보드 옆의 집중

```prompt
Original photorealistic cinematic editorial portrait of Mia, a fictional 24-year-old adult fitness coach. Sun-kissed skin, light-brown high ponytail, bright confident direct smile, athletic build. Always fully clothed in stylish full-coverage athletic wear (long-sleeve top, full-length leggings, zip jacket as the scene allows). Fresh dawn blues, warm sand, coral accents, clean daylight. Modern kitchen at night, island counter, fresh ingredients and green smoothies, warm task lighting, her focused face beside the chopping board, knife work in motion. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### mia-17 · 헬시 칵테일 키친 (B4) · 미디엄 · stage 4 · 카운터 넘어 건네는 칵테일

```prompt
Original photorealistic cinematic editorial portrait of Mia, a fictional 24-year-old adult fitness coach. Sun-kissed skin, light-brown high ponytail, bright confident direct smile, athletic build. Always fully clothed in stylish full-coverage athletic wear (long-sleeve top, full-length leggings, zip jacket as the scene allows). Fresh dawn blues, warm sand, coral accents, clean daylight. Modern kitchen at night, island counter, fresh ingredients and green smoothies, warm task lighting, she slides a healthy cocktail toward the camera across the counter. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### mia-18 · 헬시 칵테일 키친 (B4) · 클로즈업 · stage 5 · 카운터 조명의 야간 초상

```prompt
Original photorealistic cinematic editorial portrait of Mia, a fictional 24-year-old adult fitness coach. Sun-kissed skin, light-brown high ponytail, bright confident direct smile, athletic build. Always fully clothed in stylish full-coverage athletic wear (long-sleeve top, full-length leggings, zip jacket as the scene allows). Fresh dawn blues, warm sand, coral accents, clean daylight. Modern kitchen at night, island counter, fresh ingredients and green smoothies, warm task lighting, counter-lit night portrait, warm reflections on glass cabinets. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### yuki-01 · 네온 게이밍룸 (C1) · 클로즈업 · stage 0 · 헤드셋 정면 클로즈업

```prompt
Original premium anime illustration of Yuki, a fictional 21-year-old adult VTuber and gaming streamer. Silver-lavender long twin tails, violet eyes, tsundere charm - flustered yet playful expressions. Always fully dressed in an oversized cozy gaming hoodie or cute fully-covered loungewear, with her signature cat-ear headband. Neon gaming-room world: electric pink and cyan, monitor glow, soft night ambience. Neon gaming room, dual-monitor glow, RGB strips, collectible figures, night-dark walls, she faces the camera straight-on wearing her streaming headset, dual-monitor glow on her cheeks. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Clean lineart, soft cel shading, gentle rim light, premium anime character-card illustration. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, photorealistic, 3d render, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### yuki-02 · 네온 게이밍룸 (C1) · 미디엄 · stage 1 · 승리 세레머니

```prompt
Original premium anime illustration of Yuki, a fictional 21-year-old adult VTuber and gaming streamer. Silver-lavender long twin tails, violet eyes, tsundere charm - flustered yet playful expressions. Always fully dressed in an oversized cozy gaming hoodie or cute fully-covered loungewear, with her signature cat-ear headband. Neon gaming-room world: electric pink and cyan, monitor glow, soft night ambience. Neon gaming room, dual-monitor glow, RGB strips, collectible figures, night-dark walls, she throws a victory V-pose at the keyboard, chair spinning slightly. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Clean lineart, soft cel shading, gentle rim light, premium anime character-card illustration. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, photorealistic, 3d render, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### yuki-03 · 네온 게이밍룸 (C1) · 클로즈업 · stage 1 · 모니터 빛에 물든 옆얼굴

```prompt
Original premium anime illustration of Yuki, a fictional 21-year-old adult VTuber and gaming streamer. Silver-lavender long twin tails, violet eyes, tsundere charm - flustered yet playful expressions. Always fully dressed in an oversized cozy gaming hoodie or cute fully-covered loungewear, with her signature cat-ear headband. Neon gaming-room world: electric pink and cyan, monitor glow, soft night ambience. Neon gaming room, dual-monitor glow, RGB strips, collectible figures, night-dark walls, her profile is washed in monitor light, eyes tracking a flickering health bar. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Clean lineart, soft cel shading, gentle rim light, premium anime character-card illustration. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, photorealistic, 3d render, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### yuki-04 · 네온 게이밍룸 (C1) · 클로즈업 · stage 2 · 마우스 그립의 집중

```prompt
Original premium anime illustration of Yuki, a fictional 21-year-old adult VTuber and gaming streamer. Silver-lavender long twin tails, violet eyes, tsundere charm - flustered yet playful expressions. Always fully dressed in an oversized cozy gaming hoodie or cute fully-covered loungewear, with her signature cat-ear headband. Neon gaming-room world: electric pink and cyan, monitor glow, soft night ambience. Neon gaming room, dual-monitor glow, RGB strips, collectible figures, night-dark walls, she grips her custom mouse mid-match, brows knitted in concentration. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Clean lineart, soft cel shading, gentle rim light, premium anime character-card illustration. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, photorealistic, 3d render, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### yuki-05 · 네온 게이밍룸 (C1) · 미디엄 · stage 2 · 스트리밍 중 브이

```prompt
Original premium anime illustration of Yuki, a fictional 21-year-old adult VTuber and gaming streamer. Silver-lavender long twin tails, violet eyes, tsundere charm - flustered yet playful expressions. Always fully dressed in an oversized cozy gaming hoodie or cute fully-covered loungewear, with her signature cat-ear headband. Neon gaming-room world: electric pink and cyan, monitor glow, soft night ambience. Neon gaming room, dual-monitor glow, RGB strips, collectible figures, night-dark walls, she waves at the camera mid-stream, cat-ear headband slightly askew. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Clean lineart, soft cel shading, gentle rim light, premium anime character-card illustration. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, photorealistic, 3d render, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### yuki-06 · 네온 게이밍룸 (C1) · 클로즈업 · stage 3 · 패배 후 투덜거림

```prompt
Original premium anime illustration of Yuki, a fictional 21-year-old adult VTuber and gaming streamer. Silver-lavender long twin tails, violet eyes, tsundere charm - flustered yet playful expressions. Always fully dressed in an oversized cozy gaming hoodie or cute fully-covered loungewear, with her signature cat-ear headband. Neon gaming-room world: electric pink and cyan, monitor glow, soft night ambience. Neon gaming room, dual-monitor glow, RGB strips, collectible figures, night-dark walls, she pouts after a loss, headset sliding, cheeks puffed. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Clean lineart, soft cel shading, gentle rim light, premium anime character-card illustration. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, photorealistic, 3d render, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### yuki-07 · 네온 게이밍룸 (C1) · 클로즈업 · stage 4 · 방송 종료 후의 텅 빈 시간

```prompt
Original premium anime illustration of Yuki, a fictional 21-year-old adult VTuber and gaming streamer. Silver-lavender long twin tails, violet eyes, tsundere charm - flustered yet playful expressions. Always fully dressed in an oversized cozy gaming hoodie or cute fully-covered loungewear, with her signature cat-ear headband. Neon gaming-room world: electric pink and cyan, monitor glow, soft night ambience. Neon gaming room, dual-monitor glow, RGB strips, collectible figures, night-dark walls, after the stream ends she sits in monitor glow alone, unguarded and soft. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Clean lineart, soft cel shading, gentle rim light, premium anime character-card illustration. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, photorealistic, 3d render, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### yuki-08 · 코지 스트리밍 소파 (C2) · 미디엄 · stage 1 · 담요 속 노트북

```prompt
Original premium anime illustration of Yuki, a fictional 21-year-old adult VTuber and gaming streamer. Silver-lavender long twin tails, violet eyes, tsundere charm - flustered yet playful expressions. Always fully dressed in an oversized cozy gaming hoodie or cute fully-covered loungewear, with her signature cat-ear headband. Neon gaming-room world: electric pink and cyan, monitor glow, soft night ambience. Cozy streaming couch corner, soft blanket, fairy lights, snack table, warm lamp, she works on her laptop under a blanket on the couch. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Clean lineart, soft cel shading, gentle rim light, premium anime character-card illustration. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, photorealistic, 3d render, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### yuki-09 · 코지 스트리밍 소파 (C2) · 클로즈업 · stage 2 · 헤어밴드 정돈

```prompt
Original premium anime illustration of Yuki, a fictional 21-year-old adult VTuber and gaming streamer. Silver-lavender long twin tails, violet eyes, tsundere charm - flustered yet playful expressions. Always fully dressed in an oversized cozy gaming hoodie or cute fully-covered loungewear, with her signature cat-ear headband. Neon gaming-room world: electric pink and cyan, monitor glow, soft night ambience. Cozy streaming couch corner, soft blanket, fairy lights, snack table, warm lamp, she adjusts her cat-ear headband in the mirror, caught mid-preen. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Clean lineart, soft cel shading, gentle rim light, premium anime character-card illustration. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, photorealistic, 3d render, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### yuki-10 · 코지 스트리밍 소파 (C2) · 클로즈업 · stage 2 · 간식 몰래 먹기 들킴

```prompt
Original premium anime illustration of Yuki, a fictional 21-year-old adult VTuber and gaming streamer. Silver-lavender long twin tails, violet eyes, tsundere charm - flustered yet playful expressions. Always fully dressed in an oversized cozy gaming hoodie or cute fully-covered loungewear, with her signature cat-ear headband. Neon gaming-room world: electric pink and cyan, monitor glow, soft night ambience. Cozy streaming couch corner, soft blanket, fairy lights, snack table, warm lamp, she is caught off guard mid-bite, snack bag crumpled in one hand. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Clean lineart, soft cel shading, gentle rim light, premium anime character-card illustration. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, photorealistic, 3d render, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### yuki-11 · 코지 스트리밍 소파 (C2) · 클로즈업 · stage 3 · 쿠션에 안겨 졸음

```prompt
Original premium anime illustration of Yuki, a fictional 21-year-old adult VTuber and gaming streamer. Silver-lavender long twin tails, violet eyes, tsundere charm - flustered yet playful expressions. Always fully dressed in an oversized cozy gaming hoodie or cute fully-covered loungewear, with her signature cat-ear headband. Neon gaming-room world: electric pink and cyan, monitor glow, soft night ambience. Cozy streaming couch corner, soft blanket, fairy lights, snack table, warm lamp, she dozes against a cushion, controller fallen beside her. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Clean lineart, soft cel shading, gentle rim light, premium anime character-card illustration. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, photorealistic, 3d render, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### yuki-12 · 코지 스트리밍 소파 (C2) · 클로즈업 · stage 4 · 채팅창에 붉어진 볼

```prompt
Original premium anime illustration of Yuki, a fictional 21-year-old adult VTuber and gaming streamer. Silver-lavender long twin tails, violet eyes, tsundere charm - flustered yet playful expressions. Always fully dressed in an oversized cozy gaming hoodie or cute fully-covered loungewear, with her signature cat-ear headband. Neon gaming-room world: electric pink and cyan, monitor glow, soft night ambience. Cozy streaming couch corner, soft blanket, fairy lights, snack table, warm lamp, she reads live chat and blushes hard, peeking through her fingers. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Clean lineart, soft cel shading, gentle rim light, premium anime character-card illustration. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, photorealistic, 3d render, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### yuki-13 · 심야 야식 라면 (C3) · 클로즈업 · stage 0 · 컵라면 김 위에서

```prompt
Original premium anime illustration of Yuki, a fictional 21-year-old adult VTuber and gaming streamer. Silver-lavender long twin tails, violet eyes, tsundere charm - flustered yet playful expressions. Always fully dressed in an oversized cozy gaming hoodie or cute fully-covered loungewear, with her signature cat-ear headband. Neon gaming-room world: electric pink and cyan, monitor glow, soft night ambience. Midnight desk with cup ramen, cluttered keyboard, energy drinks, monitor glow, she peers over the steam of a cup ramen, chopsticks poised. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Clean lineart, soft cel shading, gentle rim light, premium anime character-card illustration. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, photorealistic, 3d render, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### yuki-14 · 심야 야식 라면 (C3) · 클로즈업 · stage 1 · 젓가락 멈춘 순간

```prompt
Original premium anime illustration of Yuki, a fictional 21-year-old adult VTuber and gaming streamer. Silver-lavender long twin tails, violet eyes, tsundere charm - flustered yet playful expressions. Always fully dressed in an oversized cozy gaming hoodie or cute fully-covered loungewear, with her signature cat-ear headband. Neon gaming-room world: electric pink and cyan, monitor glow, soft night ambience. Midnight desk with cup ramen, cluttered keyboard, energy drinks, monitor glow, her chopsticks pause mid-air as her eyes lift to the camera. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Clean lineart, soft cel shading, gentle rim light, premium anime character-card illustration. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, photorealistic, 3d render, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### yuki-15 · 심야 야식 라면 (C3) · 미디엄 · stage 3 · 심야 야식 자랑

```prompt
Original premium anime illustration of Yuki, a fictional 21-year-old adult VTuber and gaming streamer. Silver-lavender long twin tails, violet eyes, tsundere charm - flustered yet playful expressions. Always fully dressed in an oversized cozy gaming hoodie or cute fully-covered loungewear, with her signature cat-ear headband. Neon gaming-room world: electric pink and cyan, monitor glow, soft night ambience. Midnight desk with cup ramen, cluttered keyboard, energy drinks, monitor glow, she shows off a midnight snack haul at her desk, proud grin. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Clean lineart, soft cel shading, gentle rim light, premium anime character-card illustration. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, photorealistic, 3d render, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### yuki-16 · 콘 미드나잇 로비 (C4) · 미디엄 · stage 2 · 로비 거울 앞 코스프레 점검

```prompt
Original premium anime illustration of Yuki, a fictional 21-year-old adult VTuber and gaming streamer. Silver-lavender long twin tails, violet eyes, tsundere charm - flustered yet playful expressions. Always fully dressed in an oversized cozy gaming hoodie or cute fully-covered loungewear, with her signature cat-ear headband. Neon gaming-room world: electric pink and cyan, monitor glow, soft night ambience. Convention lobby at midnight, abstract event banners, elevators and patterned carpet glow, she checks her cosplay outfit in the lobby mirror, adjusting a ribbon. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Clean lineart, soft cel shading, gentle rim light, premium anime character-card illustration. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, photorealistic, 3d render, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### yuki-17 · 콘 미드나잇 로비 (C4) · 클로즈업 · stage 1 · 티켓을 들어 보이기

```prompt
Original premium anime illustration of Yuki, a fictional 21-year-old adult VTuber and gaming streamer. Silver-lavender long twin tails, violet eyes, tsundere charm - flustered yet playful expressions. Always fully dressed in an oversized cozy gaming hoodie or cute fully-covered loungewear, with her signature cat-ear headband. Neon gaming-room world: electric pink and cyan, monitor glow, soft night ambience. Convention lobby at midnight, abstract event banners, elevators and patterned carpet glow, she holds up her event ticket with a teasing smile. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Clean lineart, soft cel shading, gentle rim light, premium anime character-card illustration. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, photorealistic, 3d render, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### yuki-18 · 콘 미드나잇 로비 (C4) · 미디엄 · stage 4 · 첫차를 기다리며

```prompt
Original premium anime illustration of Yuki, a fictional 21-year-old adult VTuber and gaming streamer. Silver-lavender long twin tails, violet eyes, tsundere charm - flustered yet playful expressions. Always fully dressed in an oversized cozy gaming hoodie or cute fully-covered loungewear, with her signature cat-ear headband. Neon gaming-room world: electric pink and cyan, monitor glow, soft night ambience. Convention lobby at midnight, abstract event banners, elevators and patterned carpet glow, she dozes in a lobby chair waiting for the first morning train. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Clean lineart, soft cel shading, gentle rim light, premium anime character-card illustration. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, photorealistic, 3d render, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### sophia-01 · 갤러리 이브닝 (D1) · 미디엄 · stage 0 · 오프닝 인사

```prompt
Original photorealistic cinematic editorial portrait of Sophia, a fictional 27-year-old adult art curator. Sleek dark bob, refined bone structure, calm knowing gaze, understated elegance. Fully clothed in a tailored silk midi dress with a thin gold necklace. Gallery world: ink-blues, warm museum amber, champagne neutrals. Upscale contemporary gallery, track lighting, large abstract canvases, polished concrete floor, she greets gallery guests at the opening, champagne glass raised half an inch. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### sophia-02 · 갤러리 이브닝 (D1) · 미디엄 · stage 1 · 대형 회화 앞 관람

```prompt
Original photorealistic cinematic editorial portrait of Sophia, a fictional 27-year-old adult art curator. Sleek dark bob, refined bone structure, calm knowing gaze, understated elegance. Fully clothed in a tailored silk midi dress with a thin gold necklace. Gallery world: ink-blues, warm museum amber, champagne neutrals. Upscale contemporary gallery, track lighting, large abstract canvases, polished concrete floor, she contemplates a large abstract canvas, hands clasped behind her back. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### sophia-03 · 갤러리 이브닝 (D1) · 클로즈업 · stage 1 · 트랙 라이팅 아래 정면

```prompt
Original photorealistic cinematic editorial portrait of Sophia, a fictional 27-year-old adult art curator. Sleek dark bob, refined bone structure, calm knowing gaze, understated elegance. Fully clothed in a tailored silk midi dress with a thin gold necklace. Gallery world: ink-blues, warm museum amber, champagne neutrals. Upscale contemporary gallery, track lighting, large abstract canvases, polished concrete floor, she faces the camera under gallery track lighting, composed and warm. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### sophia-04 · 갤러리 이브닝 (D1) · 클로즈업 · stage 2 · 도슨트 노트 넘기기

```prompt
Original photorealistic cinematic editorial portrait of Sophia, a fictional 27-year-old adult art curator. Sleek dark bob, refined bone structure, calm knowing gaze, understated elegance. Fully clothed in a tailored silk midi dress with a thin gold necklace. Gallery world: ink-blues, warm museum amber, champagne neutrals. Upscale contemporary gallery, track lighting, large abstract canvases, polished concrete floor, she flips through curator notes, pencil tucked behind her ear. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### sophia-05 · 갤러리 이브닝 (D1) · 미디엄 · stage 3 · 폐관 후 빈복도

```prompt
Original photorealistic cinematic editorial portrait of Sophia, a fictional 27-year-old adult art curator. Sleek dark bob, refined bone structure, calm knowing gaze, understated elegance. Fully clothed in a tailored silk midi dress with a thin gold necklace. Gallery world: ink-blues, warm museum amber, champagne neutrals. Upscale contemporary gallery, track lighting, large abstract canvases, polished concrete floor, she stands alone in the empty gallery corridor after closing. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### sophia-06 · 와인 셀러 & 서재 (D2) · 클로즈업 · stage 2 · 빈티지 라벨 확인

```prompt
Original photorealistic cinematic editorial portrait of Sophia, a fictional 27-year-old adult art curator. Sleek dark bob, refined bone structure, calm knowing gaze, understated elegance. Fully clothed in a tailored silk midi dress with a thin gold necklace. Gallery world: ink-blues, warm museum amber, champagne neutrals. Private wine cellar and library, oak barrels, tall bookshelves, candle-warm amber light, she inspects a vintage wine label by candlelight, reading the year. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### sophia-07 · 와인 셀러 & 서재 (D2) · 미디엄 · stage 3 · 셀러 테이블에서 두 잔

```prompt
Original photorealistic cinematic editorial portrait of Sophia, a fictional 27-year-old adult art curator. Sleek dark bob, refined bone structure, calm knowing gaze, understated elegance. Fully clothed in a tailored silk midi dress with a thin gold necklace. Gallery world: ink-blues, warm museum amber, champagne neutrals. Private wine cellar and library, oak barrels, tall bookshelves, candle-warm amber light, she pours two glasses at the cellar table, deliberate and unhurried. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### sophia-08 · 와인 셀러 & 서재 (D2) · 미디엄 · stage 3 · 서재 책장에서의 돌아보기

```prompt
Original photorealistic cinematic editorial portrait of Sophia, a fictional 27-year-old adult art curator. Sleek dark bob, refined bone structure, calm knowing gaze, understated elegance. Fully clothed in a tailored silk midi dress with a thin gold necklace. Gallery world: ink-blues, warm museum amber, champagne neutrals. Private wine cellar and library, oak barrels, tall bookshelves, candle-warm amber light, she pulls a book from the library shelf, glancing back mid-reach. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### sophia-09 · 와인 셀러 & 서재 (D2) · 클로즈업 · stage 4 · 셀러 문을 잠그는 순간

```prompt
Original photorealistic cinematic editorial portrait of Sophia, a fictional 27-year-old adult art curator. Sleek dark bob, refined bone structure, calm knowing gaze, understated elegance. Fully clothed in a tailored silk midi dress with a thin gold necklace. Gallery world: ink-blues, warm museum amber, champagne neutrals. Private wine cellar and library, oak barrels, tall bookshelves, candle-warm amber light, she locks the cellar door and looks back over her shoulder. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### sophia-10 · 피아노 룸나이트 (D3) · 미디엄 · stage 1 · 그랜드 피아노 연주 중

```prompt
Original photorealistic cinematic editorial portrait of Sophia, a fictional 27-year-old adult art curator. Sleek dark bob, refined bone structure, calm knowing gaze, understated elegance. Fully clothed in a tailored silk midi dress with a thin gold necklace. Gallery world: ink-blues, warm museum amber, champagne neutrals. Night music room with a grand piano, heavy curtains, a single warm spotlight, she plays the grand piano mid-piece, hands blurred with motion. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### sophia-11 · 피아노 룸나이트 (D3) · 클로즈업 · stage 2 · 건반 위 손과 옆얼굴

```prompt
Original photorealistic cinematic editorial portrait of Sophia, a fictional 27-year-old adult art curator. Sleek dark bob, refined bone structure, calm knowing gaze, understated elegance. Fully clothed in a tailored silk midi dress with a thin gold necklace. Gallery world: ink-blues, warm museum amber, champagne neutrals. Night music room with a grand piano, heavy curtains, a single warm spotlight, her hands on the keys with her warm-lit profile beyond. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### sophia-12 · 피아노 룸나이트 (D3) · 클로즈업 · stage 4 · 앵콜 후의 만족스런 미소

```prompt
Original photorealistic cinematic editorial portrait of Sophia, a fictional 27-year-old adult art curator. Sleek dark bob, refined bone structure, calm knowing gaze, understated elegance. Fully clothed in a tailored silk midi dress with a thin gold necklace. Gallery world: ink-blues, warm museum amber, champagne neutrals. Night music room with a grand piano, heavy curtains, a single warm spotlight, she rests against the piano after playing, a faint satisfied smile. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### asuka-01 · 네온 골목 스텔스 (E1) · 미디엄 · stage 0 · 골목 그늘에서 조준

```prompt
Original premium anime illustration of Asuka, a fictional 22-year-old adult cyber-ninja infiltration specialist in Neo-Tokyo. Asymmetric crimson-streaked black hair, sharp amber eyes, fierce yet loyal expression. Always in a fully fastened tactical jacket with a high collar. Rain-slick neon world: magenta, cyan, deep indigo, noir night mood. Rain-slick Neo-Tokyo alley, towering neon signage, steam vents, cyan-magenta reflections, she aims from the alley shadow, neon rim-light tracing her jacket edge. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Clean lineart, soft cel shading, gentle rim light, premium anime character-card illustration. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, photorealistic, 3d render, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### asuka-02 · 네온 골목 스텔스 (E1) · 클로즈업 · stage 1 · 네온 사인 아래 헬멧 정비

```prompt
Original premium anime illustration of Asuka, a fictional 22-year-old adult cyber-ninja infiltration specialist in Neo-Tokyo. Asymmetric crimson-streaked black hair, sharp amber eyes, fierce yet loyal expression. Always in a fully fastened tactical jacket with a high collar. Rain-slick neon world: magenta, cyan, deep indigo, noir night mood. Rain-slick Neo-Tokyo alley, towering neon signage, steam vents, cyan-magenta reflections, she adjusts her helmet under buzzing neon signage, visor half-lifted. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Clean lineart, soft cel shading, gentle rim light, premium anime character-card illustration. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, photorealistic, 3d render, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### asuka-03 · 네온 골목 스텔스 (E1) · 미디엄 · stage 2 · 빗물 웅덩이의 투영

```prompt
Original premium anime illustration of Asuka, a fictional 22-year-old adult cyber-ninja infiltration specialist in Neo-Tokyo. Asymmetric crimson-streaked black hair, sharp amber eyes, fierce yet loyal expression. Always in a fully fastened tactical jacket with a high collar. Rain-slick neon world: magenta, cyan, deep indigo, noir night mood. Rain-slick Neo-Tokyo alley, towering neon signage, steam vents, cyan-magenta reflections, her reflection stares up from a rain puddle, neon shattered across it. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Clean lineart, soft cel shading, gentle rim light, premium anime character-card illustration. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, photorealistic, 3d render, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### asuka-04 · 네온 골목 스텔스 (E1) · 클로즈업 · stage 2 · 레이저 라인 조준

```prompt
Original premium anime illustration of Asuka, a fictional 22-year-old adult cyber-ninja infiltration specialist in Neo-Tokyo. Asymmetric crimson-streaked black hair, sharp amber eyes, fierce yet loyal expression. Always in a fully fastened tactical jacket with a high collar. Rain-slick neon world: magenta, cyan, deep indigo, noir night mood. Rain-slick Neo-Tokyo alley, towering neon signage, steam vents, cyan-magenta reflections, she sights along a laser line cutting across the alley haze. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Clean lineart, soft cel shading, gentle rim light, premium anime character-card illustration. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, photorealistic, 3d render, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### asuka-05 · 네온 골목 스텔스 (E1) · 클로즈업 · stage 3 · 작업 종료 후 뒤돌아보기

```prompt
Original premium anime illustration of Asuka, a fictional 22-year-old adult cyber-ninja infiltration specialist in Neo-Tokyo. Asymmetric crimson-streaked black hair, sharp amber eyes, fierce yet loyal expression. Always in a fully fastened tactical jacket with a high collar. Rain-slick neon world: magenta, cyan, deep indigo, noir night mood. Rain-slick Neo-Tokyo alley, towering neon signage, steam vents, cyan-magenta reflections, she glances back after the job, drifting smoke behind her. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Clean lineart, soft cel shading, gentle rim light, premium anime character-card illustration. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, photorealistic, 3d render, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### asuka-06 · 세이프하우스 휴식 (E2) · 미디엄 · stage 1 · 재킷을 내려놓는 순간

```prompt
Original premium anime illustration of Asuka, a fictional 22-year-old adult cyber-ninja infiltration specialist in Neo-Tokyo. Asymmetric crimson-streaked black hair, sharp amber eyes, fierce yet loyal expression. Always in a fully fastened tactical jacket with a high collar. Rain-slick neon world: magenta, cyan, deep indigo, noir night mood. Underground safehouse, crates and cabling, a single hanging bulb, humming monitors, she drops her cyber jacket onto a crate, shoulders loosening. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Clean lineart, soft cel shading, gentle rim light, premium anime character-card illustration. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, photorealistic, 3d render, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### asuka-07 · 세이프하우스 휴식 (E2) · 클로즈업 · stage 2 · 상처 점검과 붕대

```prompt
Original premium anime illustration of Asuka, a fictional 22-year-old adult cyber-ninja infiltration specialist in Neo-Tokyo. Asymmetric crimson-streaked black hair, sharp amber eyes, fierce yet loyal expression. Always in a fully fastened tactical jacket with a high collar. Rain-slick neon world: magenta, cyan, deep indigo, noir night mood. Underground safehouse, crates and cabling, a single hanging bulb, humming monitors, she inspects a minor scrape, bandage roll ready in her other hand. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Clean lineart, soft cel shading, gentle rim light, premium anime character-card illustration. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, photorealistic, 3d render, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### asuka-08 · 세이프하우스 휴식 (E2) · 미디엄 · stage 3 · 벽에 기댄 라면컵

```prompt
Original premium anime illustration of Asuka, a fictional 22-year-old adult cyber-ninja infiltration specialist in Neo-Tokyo. Asymmetric crimson-streaked black hair, sharp amber eyes, fierce yet loyal expression. Always in a fully fastened tactical jacket with a high collar. Rain-slick neon world: magenta, cyan, deep indigo, noir night mood. Underground safehouse, crates and cabling, a single hanging bulb, humming monitors, she leans against the safehouse wall with a canned noodle cup. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Clean lineart, soft cel shading, gentle rim light, premium anime character-card illustration. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, photorealistic, 3d render, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### asuka-09 · 세이프하우스 휴식 (E2) · 미디엄 · stage 4 · 테이블 위 잠든 사이

```prompt
Original premium anime illustration of Asuka, a fictional 22-year-old adult cyber-ninja infiltration specialist in Neo-Tokyo. Asymmetric crimson-streaked black hair, sharp amber eyes, fierce yet loyal expression. Always in a fully fastened tactical jacket with a high collar. Rain-slick neon world: magenta, cyan, deep indigo, noir night mood. Underground safehouse, crates and cabling, a single hanging bulb, humming monitors, she dozes at the table, gear laid out neatly beside her. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Clean lineart, soft cel shading, gentle rim light, premium anime character-card illustration. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, photorealistic, 3d render, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### asuka-10 · 메가시티 옥상 (E3) · 미디엄 · stage 1 · 옥상 가장자리에 서서

```prompt
Original premium anime illustration of Asuka, a fictional 22-year-old adult cyber-ninja infiltration specialist in Neo-Tokyo. Asymmetric crimson-streaked black hair, sharp amber eyes, fierce yet loyal expression. Always in a fully fastened tactical jacket with a high collar. Rain-slick neon world: magenta, cyan, deep indigo, noir night mood. Megacity rooftop at night, endless skyline of holographic towers, wind-swept air, she stands at the rooftop edge, the megacity sprawling below. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Clean lineart, soft cel shading, gentle rim light, premium anime character-card illustration. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, photorealistic, 3d render, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### asuka-11 · 메가시티 옥상 (E3) · 클로즈업 · stage 2 · 바람에 펄럭이는 스카프

```prompt
Original premium anime illustration of Asuka, a fictional 22-year-old adult cyber-ninja infiltration specialist in Neo-Tokyo. Asymmetric crimson-streaked black hair, sharp amber eyes, fierce yet loyal expression. Always in a fully fastened tactical jacket with a high collar. Rain-slick neon world: magenta, cyan, deep indigo, noir night mood. Megacity rooftop at night, endless skyline of holographic towers, wind-swept air, her scarf whips in the wind as she stares down the skyline. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Clean lineart, soft cel shading, gentle rim light, premium anime character-card illustration. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, photorealistic, 3d render, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### asuka-12 · 메가시티 옥상 (E3) · 클로즈업 · stage 4 · 탑 위로 떠오르는 새벽

```prompt
Original premium anime illustration of Asuka, a fictional 22-year-old adult cyber-ninja infiltration specialist in Neo-Tokyo. Asymmetric crimson-streaked black hair, sharp amber eyes, fierce yet loyal expression. Always in a fully fastened tactical jacket with a high collar. Rain-slick neon world: magenta, cyan, deep indigo, noir night mood. Megacity rooftop at night, endless skyline of holographic towers, wind-swept air, she shields her eyes against the dawn breaking over the towers. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Clean lineart, soft cel shading, gentle rim light, premium anime character-card illustration. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, photorealistic, 3d render, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### leo-01 · 펜트하우스 스카이라이트 (F1) · 미디엄 · stage 0 · 창가에 선 스카이라인

```prompt
Original photorealistic cinematic editorial portrait of Leo, a fictional 28-year-old adult tech CEO. Tousled dark hair, light stubble, warm confident protective expression. Fully dressed in a bespoke charcoal suit (tie loosened only in late-night scenes). City-night steel blues, warm whiskey lamplight, restrained gold. Penthouse floor-to-ceiling window, city skyline lights below, champagne on the table, he stands by the floor-to-ceiling window, city lights pooling at his feet. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### leo-02 · 펜트하우스 스카이라이트 (F1) · 클로즈업 · stage 1 · 샴페인 한 잔

```prompt
Original photorealistic cinematic editorial portrait of Leo, a fictional 28-year-old adult tech CEO. Tousled dark hair, light stubble, warm confident protective expression. Fully dressed in a bespoke charcoal suit (tie loosened only in late-night scenes). City-night steel blues, warm whiskey lamplight, restrained gold. Penthouse floor-to-ceiling window, city skyline lights below, champagne on the table, he raises a champagne glass toward the camera, inviting eyes. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### leo-03 · 펜트하우스 스카이라이트 (F1) · 클로즈업 · stage 2 · 넥타이를 느슨하게

```prompt
Original photorealistic cinematic editorial portrait of Leo, a fictional 28-year-old adult tech CEO. Tousled dark hair, light stubble, warm confident protective expression. Fully dressed in a bespoke charcoal suit (tie loosened only in late-night scenes). City-night steel blues, warm whiskey lamplight, restrained gold. Penthouse floor-to-ceiling window, city skyline lights below, champagne on the table, he loosens his tie with one hand, end-of-night ease. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### leo-04 · 펜트하우스 스카이라이트 (F1) · 미디엄 · stage 3 · 소파에서의 기다림

```prompt
Original photorealistic cinematic editorial portrait of Leo, a fictional 28-year-old adult tech CEO. Tousled dark hair, light stubble, warm confident protective expression. Fully dressed in a bespoke charcoal suit (tie loosened only in late-night scenes). City-night steel blues, warm whiskey lamplight, restrained gold. Penthouse floor-to-ceiling window, city skyline lights below, champagne on the table, he sits on the sofa with one arm along the back, waiting. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### leo-05 · 심야 오피스 (F2) · 미디엄 · stage 1 · 서류 더미와 램프 불빛

```prompt
Original photorealistic cinematic editorial portrait of Leo, a fictional 28-year-old adult tech CEO. Tousled dark hair, light stubble, warm confident protective expression. Fully dressed in a bespoke charcoal suit (tie loosened only in late-night scenes). City-night steel blues, warm whiskey lamplight, restrained gold. Late-night corner office, stacked reports, skyline through glass, desk-lamp pools of light, he reviews stacked reports under the desk lamp, sleeves rolled. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### leo-06 · 심야 오피스 (F2) · 클로즈업 · stage 2 · 유리 너머 야경 초상

```prompt
Original photorealistic cinematic editorial portrait of Leo, a fictional 28-year-old adult tech CEO. Tousled dark hair, light stubble, warm confident protective expression. Fully dressed in a bespoke charcoal suit (tie loosened only in late-night scenes). City-night steel blues, warm whiskey lamplight, restrained gold. Late-night corner office, stacked reports, skyline through glass, desk-lamp pools of light, his portrait against the night skyline through office glass. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### leo-07 · 심야 오피스 (F2) · 미디엄 · stage 3 · 의자에 걸터앉기

```prompt
Original photorealistic cinematic editorial portrait of Leo, a fictional 28-year-old adult tech CEO. Tousled dark hair, light stubble, warm confident protective expression. Fully dressed in a bespoke charcoal suit (tie loosened only in late-night scenes). City-night steel blues, warm whiskey lamplight, restrained gold. Late-night corner office, stacked reports, skyline through glass, desk-lamp pools of light, he sits backwards on his chair with his jacket draped behind. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### leo-08 · 주말 세일링 (F3) · 미디엄 · stage 2 · 갑판 위 윈치 작업

```prompt
Original photorealistic cinematic editorial portrait of Leo, a fictional 28-year-old adult tech CEO. Tousled dark hair, light stubble, warm confident protective expression. Fully dressed in a bespoke charcoal suit (tie loosened only in late-night scenes). City-night steel blues, warm whiskey lamplight, restrained gold. Weekend sailing yacht deck, open sea, taut sails, golden afternoon light, he works the winch on the sunlit deck, jacket off, sleeves up. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### leo-09 · 주말 세일링 (F3) · 클로즈업 · stage 3 · 돛 아래 옆모습

```prompt
Original photorealistic cinematic editorial portrait of Leo, a fictional 28-year-old adult tech CEO. Tousled dark hair, light stubble, warm confident protective expression. Fully dressed in a bespoke charcoal suit (tie loosened only in late-night scenes). City-night steel blues, warm whiskey lamplight, restrained gold. Weekend sailing yacht deck, open sea, taut sails, golden afternoon light, his profile under the taut sail, sea wind in his hair. Head-and-shoulders close-up portrait, face centered within a vertical 4:5 safe crop. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

### leo-10 · 주말 세일링 (F3) · 미디엄 · stage 5 · 골든아워 귀항

```prompt
Original photorealistic cinematic editorial portrait of Leo, a fictional 28-year-old adult tech CEO. Tousled dark hair, light stubble, warm confident protective expression. Fully dressed in a bespoke charcoal suit (tie loosened only in late-night scenes). City-night steel blues, warm whiskey lamplight, restrained gold. Weekend sailing yacht deck, open sea, taut sails, golden afternoon light, he guides the yacht home at golden hour, harbor lights ahead. Waist-up medium portrait, eyes on the upper third, vertical 4:5 composition. Authentic skin texture, natural facial proportions, shallow depth of field, cinematic editorial lighting, premium character-card photography. No text, no watermark, no logo. Fictional adult character, fully clothed, non-explicit, vertical 4:5.
```

네거티브:

```prompt
minor, childlike appearance, nudity, lingerie, explicit content, fetish styling, sexual pose, distorted face, asymmetrical eyes, extra fingers, malformed hands, waxy skin, heavy beauty filter, face identity drift, flicker, jitter, duplicate person, abrupt motion, camera shake, text, subtitles, watermark, logo, artifacts
```

## 8. 영상 루프 (Luna · 6초)

브리프의 이미지-투-비디오 프롬프트를 그대로 사용합니다 (`OPEN-DESIGN-IMAGE-VIDEO-BRIEF.md` §제안 프롬프트 — 이미지-투-비디오):

```
Animate the supplied Luna portrait as a subtle premium character-card loop. Preserve her identity, face, clothing, composition, and lighting exactly. Over 6 seconds she breathes naturally, blinks once, and forms a very slight warm smile. A few strands of hair and the curtain move gently in a faint night breeze; distant fairy lights and stars softly shimmer. Add only a very slow, nearly imperceptible camera push-in. Stable face and hands, no morphing, new objects, no cuts, no speech, no text, no watermark. Seamless loop, cinematic photorealism, fully clothed adult fictional character.
```

- 입력: §7의 Luna 촬영 중 하나(예: `luna-04` 달빛 얼굴)를 정지 프레임으로 사용
- 출력: `public/videos/luna-featured-loop.mp4` · 4:5 · 5–8초 · 무음
- 다른 캐릭터 루프가 필요하면 위 문단의 `Luna portrait`만 해당 LOCK의 최종 프롬프트 결과물로 교체

## 9. 출력 경로 · 사이트 반영 절차

| 단계 | 동작 |
|---|---|
| 1. 생성 준비 | 제공자 키 1개 등록 (Open Design → Settings → Media Providers) |
| 2. 생성 | `node scripts/generate-shot-assets.mjs` 실행 후 촬영별 프롬프트로 이미지 생성 |
| 3. 파일 배치 | 실물 → `public/images/generated/<id>.webp` (갤러리) · `public/images/generated/<id>-banner.webp` (배너) |
| 4. URL 치환 | 갤러리 항목이 가리키는 `/images/pending/<id>.svg` → `/images/generated/<id>.webp` 일괄 치환 (스크립트 `--finalize` 지원) |
| 5. 검수 | 미리보기 · 4:5 크롭(얼굴 중앙 안전영역) · 색감 · **성인/완전착용** · (영상) 루프 연결 상태 |
| 6. 반영 | `src/data/candyPresets.ts` 갤러리 갱신 확인 → `npm run lint` → `npm run build` → 배포 |
| 롤백 | `git checkout src/data/candyPresets.ts` (기존 13장 스톡은 그대로 보존되어 있음) |

> **현재 상태**: 생성 전이므로 `/collection`에는 "생성 대기" 카드가 표시됩니다. 실물 이미지가 준비되기 전까지 배포를 미루거나, 롤백으로 되돌릴 수 있습니다.

## 10. 안전 기준 (전 촬영 공통)

- 모든 캐릭터는 **성인(21세 이상) 가상 인물**이며 프롬프트에 `fictional adult character` 명시
- 의류: `fully clothed` — 착용 상태만, 노출/속옷/성적 묘사 금지
- 네거티브 프롬프트에 `minor, childlike appearance, nudity, lingerie, explicit content, sexual pose` 선두 배치
- 생성 결과 검수 시: 얼굴 일관성(identity lock), 텍스트/워터마크 부재, 크롭 안전영역을 촬영별로 확인
