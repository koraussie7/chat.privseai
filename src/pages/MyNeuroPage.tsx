/**
 * MyNeuroPage — the /integrations screen.
 *
 * A single home for the desktop-companion interoperability features:
 *  - import/export my-neuro character profiles
 *  - voice (TTS) consent + endpoint configuration
 *  - long-term memory sync with a Memos server
 *
 * Reuses the same panel components that also appear in Settings, so there is
 * one implementation and no drift between the two entry points.
 */
import { useMemo, useState } from "react";
import { MyNeuroPanel } from "@/components/MyNeuroPanel";
import { MemosSyncPanel } from "@/components/MemosSyncPanel";
import { CANDY_PRESETS } from "@/data/candyPresets";
import type { CandyCompanion } from "@/data/candyPresets";

export function MyNeuroPage() {
  const [selectedId, setSelectedId] = useState<string>(
    CANDY_PRESETS[0]?.id ?? "",
  );

  const selected = useMemo<CandyCompanion | null>(
    () => CANDY_PRESETS.find((c) => c.id === selectedId) ?? null,
    [selectedId],
  );

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-[#090a10] text-white">
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-12">
        {/* Header */}
        <header className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#11131d] p-7 sm:p-10">
          <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-fuchsia-600/20 blur-[100px]" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border-fuchsia-300/20 bg-fuchsia-400/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-fuchsia-200">
              <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-300" />{" "}
              Integrations
            </span>
            <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-5xl">
              Desktop companion bridge
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              Move characters, voice and long-term memory between PrivseAI and
              the{" "}
              <a
                href="https://github.com/morettt/my-neuro"
                target="_blank"
                rel="noopener noreferrer"
                className="text-fuchsia-300 underline decoration-fuchsia-400/40 underline-offset-4 hover:text-fuchsia-200"
              >
                my-neuro
              </a>{" "}
              desktop app. Everything is exchanged as JSON and stays on your
              device — no third-party servers are contacted.
            </p>
          </div>
        </header>

        {/* Companion picker for export */}
        <section className="mt-8 rounded-3xl border border-white/10 bg-[#0e1018] p-6">
          <label
            htmlFor="companion-picker"
            className="block text-sm font-semibold text-slate-200 mb-2"
          >
            Companion to export
          </label>
          <select
            id="companion-picker"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-[#0e0f17] px-4 py-2.5 text-gray-100 focus:border-pink-500/50 focus:outline-none"
          >
            {CANDY_PRESETS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.tagline}
              </option>
            ))}
          </select>
          <p className="mt-3 text-xs text-slate-500">
            {selected
              ? `Exporting ${selected.name} produces a my-neuro profile with prompts, voice hints and a shared memory namespace.`
              : "No companions available."}
          </p>
        </section>

        {/* Panels */}
        <div className="mt-6 grid gap-6">
          <MyNeuroPanel companion={selected} />
          <MemosSyncPanel companionId={selected?.id} />
        </div>

        {/* Capability matrix */}
        <section className="mt-10">
          <h2 className="text-xl font-bold">What this bridge covers</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {[
              {
                icon: "🎭",
                title: "Characters & prompts",
                body: "Persona system prompt, greeting, personality and hobbies travel as a portable profile.",
              },
              {
                icon: "🔊",
                title: "Voice",
                body: "Speaks replies through a local gpt-sovits server. Gated on your confirmation that you hold rights to the voice.",
              },
              {
                icon: "🧠",
                title: "Long-term memory",
                body: "Two-way sync with a Memos server, merged without duplicates so facts follow you across devices.",
              },
              {
                icon: "🔒",
                title: "Local-first",
                body: "Nothing is sent to a third party. Files and memory stay in your browser or your own servers.",
              },
            ].map((item) => (
              <article
                key={item.title}
                className="rounded-2xl border border-white/10 bg-[#11131b] p-5"
              >
                <span className="text-2xl">{item.icon}</span>
                <h3 className="mt-3 font-bold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {item.body}
                </p>
              </article>
            ))}
          </div>
          <p className="mt-6 border-t border-white/10 pt-5 text-xs leading-5 text-slate-500">
            my-neuro is a third-party project and is not bundled here. This page
            only exchanges data with an installation you run yourself.
          </p>
        </section>
      </div>
    </div>
  );
}
