#!/usr/bin/env node
/**
 * PrivseAI 갤러리 확장 에셋 빌드
 *
 * 단일 소스: OPEN-DESIGN-SHOTLIST.json
 * 실행:      node scripts/generate-shot-assets.mjs [--finalize]
 *
 * 동작 (기본):
 *   1. OPEN-DESIGN-PROMPT-PACK.md 의 <!-- SHOT-TABLE --> 섹션을 촬영별 완성 프롬프트로 재생성
 *   2. public/images/pending/<id>.svg 대기 카드 100장 생성
 *   3. src/data/candyPresets.ts 각 캐릭터 gallery에 항목 주입 (멱등: 주입된 캐릭터는 건너뜀)
 *
 * 동작 (--finalize, 생성 완료 후):
 *   candyPresets.ts 의 /images/pending/<id>.svg 를 /images/generated/<id>.webp 로 일괄 치환
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHOTLIST = join(ROOT, "OPEN-DESIGN-SHOTLIST.json");
const PACK = join(ROOT, "OPEN-DESIGN-PROMPT-PACK.md");
const PRESETS = join(ROOT, "src/data/candyPresets.ts");
const PENDING_DIR = join(ROOT, "public/images/pending");

const data = JSON.parse(readFileSync(SHOTLIST, "utf8"));
const { style, shots } = data;

function assemble(shot) {
  const lock = style.locks[shot.char];
  const scene = style.scenes[shot.scene];
  const frame = style.frames[shot.framing];
  const suffix = style.suffix[lock.mode];
  const negative = style.negatives[lock.mode];
  const prompt = `${lock.lock} ${scene.en}, ${shot.action}. ${frame}. ${suffix}`;
  return { prompt, negative, mode: lock.mode, scene };
}

/* ---------- 1. 프롬프트 팩 테이블 주입 ---------- */
function injectPack() {
  const blocks = shots
    .map((shot) => {
      const { prompt, negative, scene } = assemble(shot);
      const framingKo = shot.framing === "CU" ? "클로즈업" : "미디엄";
      const meta = `${shot.id} · ${scene.ko} (${shot.scene}) · ${framingKo} · stage ${shot.stage} · ${shot.title}`;
      return `### ${meta}\n\n\`\`\`prompt\n${prompt}\n\`\`\`\n\n네거티브:\n\n\`\`\`prompt\n${negative}\n\`\`\`\n`;
    })
    .join("\n");

  const md = readFileSync(PACK, "utf8");
  const marker = "<!-- SHOT-TABLE -->";
  const mIdx = md.indexOf(marker);
  if (mIdx === -1) throw new Error(`${PACK}: ${marker} 마커를 찾을 수 없음`);
  const nextHeading = md.indexOf("\n## 8.", mIdx);
  if (nextHeading === -1) throw new Error(`${PACK}: "## 8." 섹션을 찾을 수 없음`);

  const out =
    md.slice(0, mIdx) +
    `${marker}\n\n${blocks}\n` +
    md.slice(nextHeading + 1); // keep the newline before "## 8."
  writeFileSync(PACK, out);
  console.log(`pack: ${shots.length}개 촬영 프롬프트 주입 완료`);
}

/* ---------- 2. 대기 SVG 카드 ---------- */
const ACCENT = {
  luna: "#c08cb0",
  mia: "#ff9266",
  yuki: "#ff5fd0",
  sophia: "#d8b07a",
  asuka: "#ff3d81",
  leo: "#7aa8ff",
};

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function pendingSvg(shot, scene) {
  const accent = ACCENT[shot.char] || "#c08cb0";
  const name = style.locks[shot.char].name;
  const framingKo = shot.framing === "CU" ? "클로즈업" : "미디엄";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000" role="img" aria-label="${esc(shot.title)} 생성 대기">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#101426"/>
      <stop offset="55%" stop-color="#171c33"/>
      <stop offset="100%" stop-color="#0c0f1d"/>
    </linearGradient>
    <linearGradient id="glow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.32"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="800" height="1000" fill="url(#bg)"/>
  <rect width="800" height="420" fill="url(#glow)"/>
  <g stroke="#ffffff" stroke-opacity="0.05">
    <line x1="0" y1="250" x2="800" y2="250"/>
    <line x1="0" y1="500" x2="800" y2="500"/>
    <line x1="0" y1="750" x2="800" y2="750"/>
    <line x1="200" y1="0" x2="200" y2="1000"/>
    <line x1="400" y1="0" x2="400" y2="1000"/>
    <line x1="600" y1="0" x2="600" y2="1000"/>
  </g>
  <rect x="0" y="0" width="800" height="10" fill="${accent}"/>
  <text x="56" y="120" fill="${accent}" font-family="ui-monospace, Menlo, monospace" font-size="30" letter-spacing="4">${esc(
    shot.id,
  ).toUpperCase()}</text>
  <text x="56" y="470" fill="#f4f2ee" font-family="-apple-system, 'Apple SD Gothic Neo', sans-serif" font-size="52" font-weight="700">${esc(
    shot.title,
  )}</text>
  <text x="56" y="530" fill="#9aa0b8" font-family="-apple-system, 'Apple SD Gothic Neo', sans-serif" font-size="30">${esc(
    scene.ko,
  )} · ${esc(name)} · ${framingKo} · 4:5</text>
  <g transform="translate(56, 852)">
    <rect width="220" height="72" rx="36" fill="none" stroke="${accent}" stroke-width="2"/>
    <text x="110" y="46" text-anchor="middle" fill="${accent}" font-family="-apple-system, 'Apple SD Gothic Neo', sans-serif" font-size="28">생성 대기</text>
  </g>
  <text x="56" y="956" fill="#5b6076" font-family="ui-monospace, Menlo, monospace" font-size="24">stage ${shot.stage} · ${shot.framing} · OPEN-DESIGN-SHOTLIST</text>
</svg>
`;
}

function buildPending() {
  mkdirSync(PENDING_DIR, { recursive: true });
  for (const shot of shots) {
    writeFileSync(
      join(PENDING_DIR, `${shot.id}.svg`),
      pendingSvg(shot, style.scenes[shot.scene]),
    );
  }
  console.log(`pending: 대기 SVG ${shots.length}장 → public/images/pending/`);
}

/* ---------- 3. candyPresets.ts 갤러리 주입 ---------- */
function patchPresets() {
  let src = readFileSync(PRESETS, "utf8");
  const chars = [...new Set(shots.map((s) => s.char))];
  let injected = 0;

  for (const char of chars) {
    const charShots = shots.filter((s) => s.char === char);
    if (src.includes(`"${charShots[0].id}"`)) {
      console.log(`presets: ${char} 이미 주입됨 (건너뜀)`);
      continue;
    }
    const charIdx = src.indexOf(`id: "${char}"`);
    if (charIdx === -1) throw new Error(`candyPresets.ts: 캐릭터 ${char} 항목 없음`);
    const galStart = src.indexOf("gallery: [", charIdx);
    const galEnd = src.indexOf("\n    ],", galStart);
    if (galStart === -1 || galEnd === -1)
      throw new Error(`candyPresets.ts: ${char} gallery 닫는 괄호 없음`);

    const entries = charShots
      .map((shot) => {
        const scene = style.scenes[shot.scene];
        const unlocked = shot.stage <= 1 ? "true" : "false";
        return `      {
        id: "${shot.id}",
        url: "/images/pending/${shot.id}.svg",
        title: "${scene.ko} — ${shot.title}",
        isUnlocked: ${unlocked},
        requiredStage: ${shot.stage},
      },`;
      })
      .join("\n");

    src = src.slice(0, galEnd) + "\n" + entries + src.slice(galEnd);
    injected += charShots.length;
    console.log(`presets: ${char} +${charShots.length}개 항목 주입`);
  }

  writeFileSync(PRESETS, src);
  console.log(`presets: 총 +${injected}개 주입 완료`);
}

/* ---------- 4. --finalize: pending → generated 치환 ---------- */
function finalize() {
  let src = readFileSync(PRESETS, "utf8");
  const re = /\/images\/pending\/([a-z]+-\d{2})\.svg/g;
  const found = src.match(re) || [];
  src = src.replace(re, (_m, id) => `/images/generated/${id}.webp`);
  writeFileSync(PRESETS, src);
  console.log(`finalize: ${found.length}개 URL을 /images/generated/*.webp 로 치환`);
}

/* ---------- main ---------- */
const mode = process.argv[2];
if (mode === "--finalize") {
  finalize();
} else {
  injectPack();
  buildPending();
  patchPresets();
  if (!existsSync(PENDING_DIR)) throw new Error("pending 디렉토리 생성 실패");
  console.log("완료. 다음 단계: 프롬프트로 이미지 생성 후 --finalize 실행.");
}
