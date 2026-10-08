import { useState } from "react";
import type { CandyCompanion } from "@/data/candyPresets";

interface Props {
  companions: CandyCompanion[];
}

export function CandyCollection({ companions }: Props) {
  const [activeFilter, setActiveFilter] = useState<
    "all" | "unlocked" | "locked"
  >("all");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const allPhotos = companions.flatMap((c) =>
    c.gallery.map((g) => ({
      ...g,
      companionName: c.name,
      companionAvatar: c.avatarUrl,
      companionCategory: c.category,
    })),
  );

  const filteredPhotos = allPhotos.filter((p) => {
    if (activeFilter === "unlocked") return p.isUnlocked;
    if (activeFilter === "locked") return !p.isUnlocked;
    return true;
  });

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            📸 Secret Gallery & Memories
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            AI 여자친구들이 대화와 호감도 달성을 통해 보내준 특별한 셀카와
            사진첩입니다.
          </p>
        </div>

        <div className="flex items-center gap-2 p-1 bg-[#13141f] rounded-2xl border border-white/10">
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeFilter === "all"
                ? "bg-candy-gradient text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            All ({allPhotos.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("unlocked")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeFilter === "unlocked"
                ? "bg-candy-gradient text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Unlocked
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("locked")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeFilter === "locked"
                ? "bg-candy-gradient text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Locked 🔒
          </button>
        </div>
      </div>

      {/* Photos Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {filteredPhotos.map((photo) => (
          <div
            key={`${photo.companionName}-${photo.id}`}
            onClick={() => photo.isUnlocked && setSelectedImage(photo.url)}
            className={`relative aspect-[3/4] rounded-3xl overflow-hidden border border-white/10 ${
              photo.isUnlocked
                ? "cursor-pointer group hover:border-pink-500/50 hover:shadow-xl hover:shadow-pink-500/10"
                : "cursor-not-allowed bg-black/60"
            }`}
          >
            <img
              src={photo.url}
              alt={photo.title}
              className={`w-full h-full object-cover transition-transform duration-500 ${
                photo.isUnlocked
                  ? "group-hover:scale-105"
                  : "blur-lg grayscale opacity-30"
              }`}
            />

            {!photo.isUnlocked && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
                <span className="text-3xl mb-1">🔒</span>
                <span className="text-xs font-bold text-pink-300">
                  Level {(photo.requiredStage ?? 0) + 1} Unlock
                </span>
                <span className="text-[10px] text-gray-400 mt-1">
                  {photo.companionName}
                </span>
              </div>
            )}

            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">
                  {photo.title}
                </div>
                <div className="text-[10px] text-pink-300">
                  {photo.companionName}
                </div>
              </div>
              <img
                src={photo.companionAvatar}
                alt=""
                className="w-6 h-6 rounded-full object-cover ring-1 ring-white/20 shrink-0"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-2xl max-h-[90vh]">
            <img
              src={selectedImage}
              alt="Enlarged"
              className="rounded-3xl max-h-[85vh] w-auto object-contain border border-white/20 shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/60 text-white font-bold hover:bg-black/90 flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
