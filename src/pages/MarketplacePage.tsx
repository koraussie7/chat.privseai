import { Link } from "react-router-dom";
import { useI18n } from "@/lib/i18n";

export function MarketplacePage() {
  const { t } = useI18n();
  const categories = [
    { icon: "🖼️", title: t("marketplace.images"), body: t("marketplace.imagesBody") },
    { icon: "🎞️", title: t("marketplace.videos"), body: t("marketplace.videosBody") },
    { icon: "🧠", title: t("marketplace.models"), body: t("marketplace.modelsBody") },
    { icon: "💬", title: t("marketplace.characters"), body: t("marketplace.charactersBody") },
  ];
  const phases = [
    { n: "01", title: t("marketplace.phaseCatalog"), body: t("marketplace.phaseCatalogBody"), state: t("marketplace.available") },
    { n: "02", title: t("marketplace.phaseP2p"), body: t("marketplace.phaseP2pBody"), state: t("marketplace.inProgress") },
    { n: "03", title: t("marketplace.phaseNft"), body: t("marketplace.phaseNftBody"), state: t("marketplace.planned") },
  ];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-[#090a10] text-white">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
        <section className="relative overflow-hidden rounded-[2rem] border-white/10 bg-[#11131d] p-7 sm:p-10 lg:p-14">
          <div className="pointer-events-none absolute -right-12 -top-24 h-80 w-80 rounded-full bg-fuchsia-600/20 blur-[100px]" />
          <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-cyan-500/10 blur-[100px]" />
          <div className="relative max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border-fuchsia-300/20 bg-fuchsia-400/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-fuchsia-200">
              <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-300" /> {t("marketplace.eyebrow")}
            </span>
            <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-6xl">{t("marketplace.title")}</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">{t("marketplace.subtitle")}</p>
            <div className="mt-8 flex-wrap gap-3">
              <Link to="/hub" className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-slate-200">{t("marketplace.exploreHub")} <span aria-hidden="true">↗</span></Link>
              <Link to="/collection" className="rounded-xl border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]">{t("marketplace.openCollection")}</Link>
            </div>
            <p className="mt-5 text-xs leading-5 text-slate-500">{t("marketplace.noCheckoutNotice")}</p>
          </div>
          <div aria-hidden="true" className="relative mt-10 grid max-w-xl grid-cols-4 gap-3 sm:absolute sm:bottom-10 sm:right-10 sm:mt-0 sm:w-[34%]">
            {["🖼️", "🎞️", "🧠", "💬"].map((icon, index) => <div key={icon} className={`grid aspect-square place-items-center rounded-2xl border-white/10 bg-white/[0.04] text-3xl shadow-xl sm:text-4xl ${index % 2 ? "sm:translate-y-5" : ""}`}>{icon}</div>)}
          </div>
        </section>

        <section className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">{t("marketplace.categoriesEyebrow")}</p><h2 className="mt-2 text-2xl font-bold sm:text-3xl">{t("marketplace.categoriesTitle")}</h2></div>
            <span className="rounded-full border-amber-300/20 bg-amber-400/5 px-3 py-1.5 text-xs font-semibold text-amber-200">{t("marketplace.catalogStatus")}</span>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {categories.map((item) => <article key={item.title} className="rounded-2xl border-white/10 bg-[#11131b] p-5 transition hover:-translate-y-0.5 hover:border-white/20"><span className="text-3xl">{item.icon}</span><h3 className="mt-4 font-bold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{item.body}</p></article>)}
          </div>
        </section>

        <section className="mt-12 rounded-3xl border-white/10 bg-[#0e1018] p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-fuchsia-300">{t("marketplace.roadmapEyebrow")}</p>
          <h2 className="mt-2 text-2xl font-bold">{t("marketplace.roadmapTitle")}</h2>
          <div className="mt-6 grid gap-3 lg:grid-cols-3">
            {phases.map((phase) => <article key={phase.n} className="rounded-2xl border-white/[0.08] bg-white/[0.025] p-5"><div className="flex items-center justify-between"><span className="font-mono text-sm text-slate-500">{phase.n}</span><span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-300">{phase.state}</span></div><h3 className="mt-5 font-bold">{phase.title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{phase.body}</p></article>)}
          </div>
          <p className="mt-6 border-t border-white/[0.08] pt-5 text-xs leading-5 text-slate-500">{t("marketplace.rightsNotice")}</p>
        </section>
      </div>
    </div>
  );
}
