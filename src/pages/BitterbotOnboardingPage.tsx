/**
 * BitterbotOnboardingPage — /onboarding/bitterbot
 *
 * BYOK funnel (synergy.md 방안 A):
 *   1. Download bitterbot-desktop (user's own machine, MIT upstream)
 *   2. Create THEIR OWN free Kilo account + key (we never ship keys)
 *   3. Paste key → download generated provision script + companion seed
 *      → run once → companion lives in bitterbot with shared memory.
 *
 * The key pasted here stays in the browser until the script is generated;
 * nothing is uploaded to privseai servers (no network calls on this page).
 */
import { useMemo, useState } from "react";
import { MyNeuroPanel } from "@/components/MyNeuroPanel";
import type { CandyCompanion } from "@/data/candyPresets";
import { CANDY_PRESETS } from "@/data/candyPresets";
import { companionToBitterbotSeed, validateBitterbotSeed } from "@/lib/integration/BitterbotAdapter";
import { companionToMyNeuro } from "@/lib/integration/MyNeuroAdapter";
import {
	BITTERBOT_REPO,
	BITTERBOT_RELEASES,
	KILO_SIGNUP_URL,
	BITTERBOT_DOWNLOAD_LABEL,
	buildProvisionScript,
	detectBitterbotOs,
	downloadFile,
	kiloKeyExpiryHint,
	looksLikeKiloKey,
} from "@/lib/bitterbot-download";

interface Props {
	onBack?: () => void;
}

const STEPS = ["bitterbot 설치", "Kilo 무료 키 발급", "키 연결 + 시드 내보내기"] as const;

export function BitterbotOnboardingPage({ onBack }: Props) {
	const [step, setStep] = useState(0);
	const [kiloKey, setKiloKey] = useState("");
	const [groqKey, setGroqKey] = useState("");
	const [companionId, setCompanionId] = useState<string>(CANDY_PRESETS[0]?.id ?? "");
	const os = useMemo(() => detectBitterbotOs(), []);
	const isMobile = useMemo(
		() =>
			typeof navigator !== "undefined" &&
			/Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
		[],
	);

	const companion = useMemo<CandyCompanion | null>(
		() => CANDY_PRESETS.find((c) => c.id === companionId) ?? null,
		[companionId],
	);

	const keyOk = looksLikeKiloKey(kiloKey);
	const keyHint = keyOk ? kiloKeyExpiryHint(kiloKey) : null;

	const buildSeed = () => {
		if (!companion) return null;
		const profile = companionToMyNeuro(companion);
		profile.llm = { provider: "local", model: profile.llm?.model ?? "qwen2.5-7b-instruct" };
		const seed = companionToBitterbotSeed(companion, profile);
		const problems = validateBitterbotSeed(seed);
		return problems.length ? null : seed;
	};

	const handleDownloadBundle = () => {
		const seed = buildSeed();
		if (!seed || !keyOk) return;
		const script = buildProvisionScript({ kiloKey: kiloKey.trim(), groqKey: groqKey.trim() || undefined });
		downloadFile(`${seed.companionId}.bitterbot-seed.json`, JSON.stringify(seed, null, 2));
		downloadFile("provision.sh", script, "text/x-shellscript");
	};

	return (
		<div className="flex-1 min-h-0 overflow-y-auto bg-[#090a10] text-white">
			<div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
				<header>
					<span className="inline-flex items-center gap-2 rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-fuchsia-200">
						Desktop bridge · BYOK
					</span>
					<h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
						PrivseAI 컴패니언을 bitterbot으로
					</h1>
					<p className="mt-2 text-sm text-white/60">
						웹 컴패니언이 데스크톱에서 음성·기억과 함께 살아나게 합니다. 키는 당신 것만 씁니다 —
						어디에도 전송되지 않습니다.
					</p>
					{onBack ? (
						<button
							type="button"
							onClick={onBack}
							className="mt-3 text-xs text-white/50 underline hover:text-white/80"
						>
							← 돌아가기
						</button>
					) : null}
				</header>

				<nav className="mt-6 flex gap-2">
					{STEPS.map((label, i) => (
						<button
							key={label}
							type="button"
							onClick={() => setStep(i)}
							className={`rounded-full px-4 py-1.5 text-xs font-bold ${
								step === i
									? "bg-fuchsia-500 text-white"
									: "bg-white/5 text-white/60 hover:bg-white/10"
							}`}
						>
							{i + 1}. {label}
						</button>
					))}
				</nav>

				{isMobile ? (
					<section className="mt-6 space-y-3 rounded-2xl border border-emerald-300/20 bg-emerald-400/5 p-6">
						<h2 className="text-lg font-bold">📱 모바일 기기입니다</h2>
						<p className="text-sm text-white/60">
							bitterbot 데스크톱 브릿지는 PC에서 진행해 주세요. 모바일에서는 지금 이 앱을
							<strong className="text-white/90"> 홈 화면에 추가</strong>하면 컴패니언을 그대로 쓸 수
							있습니다 (온디바이스 WebLLM 지원).
						</p>
						<ul className="list-disc space-y-1 pl-5 text-xs text-white/50">
							<li>
								<strong className="text-white/80">iOS:</strong> Safari 공유 버튼 → &quot;홈 화면에
								추가&quot;
							</li>
							<li>
								<strong className="text-white/80">Android:</strong> Chrome 메뉴(⋮) →
								&quot;앱 설치&quot;
							</li>
						</ul>
					</section>
				) : null}

				{step === 0 && !isMobile ? (
					<section className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-[#11131d] p-6">
						<h2 className="text-lg font-bold">① bitterbot-desktop 설치</h2>
						<p className="text-sm text-white/60">
							bitterbot-desktop은 MIT 라이선스 오픈소스 에이전트입니다. 감지된 환경:{" "}
							<strong className="text-white/90">{BITTERBOT_DOWNLOAD_LABEL[os]}</strong>
						</p>
						<div className="flex flex-wrap gap-3">
							<a
								href={BITTERBOT_RELEASES}
								target="_blank"
								rel="noreferrer"
								className="rounded-xl bg-fuchsia-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-fuchsia-400"
							>
								⬇ Releases에서 받기 ({BITTERBOT_DOWNLOAD_LABEL[os]})
							</a>
							<a
								href={BITTERBOT_REPO}
								target="_blank"
								rel="noreferrer"
								className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-bold text-white/80 hover:bg-white/5"
							>
								소스 보기 (GitHub)
							</a>
						</div>
						<p className="text-xs text-white/40">
							설치 후 첫 실행까지 완료했으면 다음 단계로.
						</p>
						<button
							type="button"
							onClick={() => setStep(1)}
							className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-bold hover:bg-white/20"
						>
							다음 →
						</button>
					</section>
				) : null}

				{step === 1 ? (
					<section className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-[#11131d] p-6">
						<h2 className="text-lg font-bold">② 무료 Kilo 계정 &amp; 키 발급 (본인 키)</h2>
						<p className="text-sm text-white/60">
							Kilo Gateway 무료 티어는 계정별 발급입니다. 당신의 계정에서 키를 만들어 붙여넣어
							주세요. PrivseAI는 키를 저장·전송하지 않습니다.
						</p>
						<a
							href={KILO_SIGNUP_URL}
							target="_blank"
							rel="noreferrer"
							className="inline-block rounded-xl bg-white/10 px-5 py-2.5 text-sm font-bold hover:bg-white/20"
						>
							app.kilo.ai 에서 계정 만들기 ↗
						</a>
						<label className="block text-xs font-bold uppercase tracking-wide text-white/50">
							Kilo API Key
						</label>
						<input
							type="password"
							value={kiloKey}
							onChange={(e) => setKiloKey(e.target.value)}
							placeholder="eyJhbGciOi... (JWT)"
							className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 font-mono text-sm outline-none focus:border-fuchsia-400/50"
							autoComplete="off"
							spellCheck={false}
						/>
						{kiloKey ? (
							keyOk ? (
								<p className="text-xs text-emerald-300">
									✓ 형식 확인됨 {keyHint ? `· ${keyHint}` : ""}
								</p>
							) : (
								<p className="text-xs text-amber-300">
									형식이 Kilo JWT와 다릅니다 — 발급받은 키 전체를 복사했는지 확인해 주세요.
								</p>
							)
						) : null}
						<label className="block text-xs font-bold uppercase tracking-wide text-white/50">
							Groq API Key (선택 — gpt-oss-120b 무료 폴백)
						</label>
						<input
							type="password"
							value={groqKey}
							onChange={(e) => setGroqKey(e.target.value)}
							placeholder="gsk_... (선택)"
							className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 font-mono text-sm outline-none focus:border-fuchsia-400/50"
							autoComplete="off"
							spellCheck={false}
						/>
						<p className="text-xs text-white/40">
							키 없이도 WebLLM(온디바이스)은 동작합니다. Kilo 키는 유료 크레딧 없이
							kilo-auto/free 티어를 씁니다.
						</p>
						<div className="flex gap-3">
							<button
								type="button"
								onClick={() => setStep(0)}
								className="rounded-xl bg-white/5 px-5 py-2.5 text-sm font-bold text-white/60 hover:bg-white/10"
							>
								← 이전
							</button>
							<button
								type="button"
								disabled={!keyOk}
								onClick={() => setStep(2)}
								className="rounded-xl bg-fuchsia-500 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40"
							>
								다음 →
							</button>
						</div>
					</section>
				) : null}

				{step === 2 ? (
					<section className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-[#11131d] p-6">
						<h2 className="text-lg font-bold">③ 컴패니언 선택 → 시드 + 프로비저닝 스크립트</h2>
						<p className="text-sm text-white/60">
							가져갈 컴패니언을 고르면 <code className="text-white/80">bitterbot-seed.json</code>과
							생성형 <code className="text-white/80">provision.sh</code>가 다운로드됩니다. 스크립트는
							당신 키를 당신 머신의 bitterbot 설정에만 기록합니다.
						</p>
						<select
							value={companionId}
							onChange={(e) => setCompanionId(e.target.value)}
							className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-fuchsia-400/50"
						>
							{CANDY_PRESETS.map((c) => (
								<option key={c.id} value={c.id}>
									{c.name}
									{c.tagline ? ` — ${c.tagline}` : ""}
								</option>
							))}
						</select>

						<div className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs text-white/60">
							<p className="font-bold text-white/80">실행 방법 (macOS/Linux)</p>
							<ol className="mt-2 list-decimal space-y-1 pl-4">
								<li>다운로드된 두 파일을 같은 폴더에 둔다</li>
								<li>
									<code className="text-white/85">chmod +x provision.sh</code>
								</li>
								<li>
									<code className="text-white/85">
										KILO_KEY=&quot;붙여넣은키&quot; ./provision.sh ./&lt;companion&gt;.bitterbot-seed.json
									</code>
								</li>
								<li>bitterbot을 다시 시작하면 컴패니언이 identity로 주입됩니다</li>
							</ol>
						</div>

						<div className="flex flex-wrap gap-3">
							<button
								type="button"
								onClick={() => setStep(1)}
								className="rounded-xl bg-white/5 px-5 py-2.5 text-sm font-bold text-white/60 hover:bg-white/10"
							>
								← 이전
							</button>
							<button
								type="button"
								disabled={!keyOk || !companion}
								onClick={handleDownloadBundle}
								className="rounded-xl bg-fuchsia-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-fuchsia-400 disabled:opacity-40"
							>
								⬇ 시드 + provision.sh 다운로드
							</button>
						</div>

						{companion ? (
							<div className="mt-2 rounded-xl border border-white/5 bg-black/20 p-4">
								<p className="text-xs font-bold uppercase tracking-wide text-white/50">
									고급: my-neuro 상호 운용
								</p>
								<MyNeuroPanel companion={companion} />
							</div>
						) : null}
					</section>
				) : null}

				<footer className="mt-8 rounded-2xl border border-white/5 bg-black/20 p-4 text-xs text-white/40">
					프라이버시: 이 페이지는 네트워크 요청을 하지 않습니다. 키는 스크립트 생성에만 쓰이고
					브라우저 메모리에서만 존재합니다. 컴패니언 모드 에이전트는 셸·브라우저·지갑 도구가
					비활성화된 상태로 시드됩니다 (synergy.md 선행조건 반영).
				</footer>
			</div>
		</div>
	);
}
