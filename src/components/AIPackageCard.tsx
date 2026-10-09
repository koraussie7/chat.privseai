import { AIHub } from "@/lib/ai-hub";
import type { AIPackage } from "@/types/ai-package";

interface Props {
  readonly pkg: AIPackage;
  onSelect?: (pkg: AIPackage) => void;
  onChat: (pkg: AIPackage) => void;
  onClone: (pkg: AIPackage) => void;
  onRemix: (pkg: AIPackage) => void;
  onShare: (pkg: AIPackage) => void;
  onReplacePlaceholder?: (pkg: AIPackage) => void;
  isGenerating?: boolean;
  comfyuiOnline?: boolean;
}

export function AIPackageCard({
  pkg,
  onSelect,
  onChat,
  onClone,
  onRemix,
  onShare,
  onReplacePlaceholder,
  isGenerating = false,
  comfyuiOnline = false,
}: Props) {
  const image =
    pkg.media.avatarUrl || pkg.media.bannerUrl || pkg.card.data.src || "";
  const isPlaceholder = AIHub.isPlaceholderUrl(image);
  return (
    <article className="group overflow-hidden rounded-3xl border-white/10 bg-[#12141e] transition hover:-translate-y-1 hover:border-cyan-400/40 hover:shadow-xl hover:shadow-cyan-950/30">
      <button
        type="button"
        onClick={() => onSelect?.(pkg)}
        className="block w-full text-left"
        aria-label={`View ${pkg.metadata.name} details`}
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-cyan-950 to-purple-950">
          {image ? (
            <img
              src={image}
              alt={pkg.metadata.name}
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div
              className="grid h-full place-items-center text-6xl"
              aria-hidden="true"
            >
              🧠
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d111b] via-transparent to-black/10" />
          <div className="absolute left-3 top-3 flex gap-2">
            <span className="rounded-full border-cyan-300/20 bg-black/50 px-2.5 py-1 text-[10px] font-semibold text-cyan-200">
              {pkg.metadata.isPublic ? "P2P · shared" : "Local package"}
            </span>
            {pkg.forkedFrom && (
              <span className="rounded-full border-purple-300/20 bg-black/50 px-2.5 py-1 text-[10px] text-purple-200">
                Remix
              </span>
            )}
          </div>
          <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs text-cyan-200/80">
                {pkg.metadata.category}
              </p>
              <h2 className="text-xl font-bold text-white">
                {pkg.metadata.name}
              </h2>
            </div>
            <span className="rounded-xl border-white/15 bg-black/30 px-3 py-2 text-sm text-white">
              Details ↗
            </span>
          </div>
        </div>
      </button>
      <div className="p-4">
        <p className="mb-3 line-clamp-2 min-h-10 text-sm leading-relaxed text-slate-300">
          {pkg.metadata.description ||
            pkg.card.data.description ||
            "A character package ready to personalize."}
        </p>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {pkg.metadata.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="rounded-md border-white/5 bg-white/[0.04] px-2 py-1 text-[10px] text-slate-300"
            >
              #{tag}
            </span>
          ))}
        </div>
        <div className="mb-4 flex items-center justify-between text-xs text-slate-400">
          <span>
            by{" "}
            <strong className="font-medium text-slate-200">
              {pkg.metadata.creator}
            </strong>
          </span>
          <span>💾 {pkg.metadata.baseModel}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onChat(pkg)}
            className="rounded-xl bg-candy-gradient px-3 py-2.5 text-xs font-bold text-white"
          >
            💬 Chat
          </button>
          <button
            type="button"
            onClick={() => onClone(pkg)}
            className="rounded-xl border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-semibold text-slate-200 hover:border-cyan-300/40"
          >
            📥 Clone
          </button>
          <button
            type="button"
            onClick={() => onRemix(pkg)}
            className="rounded-xl border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-semibold text-slate-200 hover:border-purple-300/40"
          >
            🔱 Remix
          </button>
          <button
            type="button"
            onClick={() => onShare(pkg)}
            className="rounded-xl border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-semibold text-slate-200 hover:border-cyan-300/40"
          >
            🌐 Share
          </button>
          {onReplacePlaceholder && isPlaceholder && (
            <button
              type="button"
              disabled={!comfyuiOnline || isGenerating}
              onClick={() => onReplacePlaceholder(pkg)}
              title={
                comfyuiOnline
                  ? "Generate a real AI portrait via ComfyUI"
                  : "ComfyUI is not online"
              }
              className="col-span-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-3 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating ? "✨ Generating…" : "✨ Generate Real Image"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
