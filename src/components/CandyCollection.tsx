import { CharacterDetailView } from "@/components/CharacterDetailView";
import { CANDY_PRESETS, type CandyCompanion } from "@/data/candyPresets";
import { useMemo, useState } from "react";

interface Props {
  companions: CandyCompanion[];
  onEdit?: (companion: CandyCompanion) => void;
  onDelete?: (id: string) => void;
}

type Tab = "characters" | "images" | "styles";

const isCustomCompanion = (companion: CandyCompanion) =>
  !CANDY_PRESETS.some((preset) => preset.id === companion.id);

export function CandyCollection({ companions, onEdit, onDelete }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("characters");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedCharacter, setSelectedCharacter] =
    useState<CandyCompanion | null>(null);

  const allPhotos = useMemo(
    () =>
      companions.flatMap((c) =>
        c.gallery.map((g) => ({
          ...g,
          companionName: c.name,
          companionAvatar: c.avatarUrl,
          companionCategory: c.category,
          companionStage: c.stage,
          companionId: c.id,
        })),
      ),
    [companions],
  );

  const unlockedPhotos = useMemo(
    () => allPhotos.filter((p) => p.isUnlocked),
    [allPhotos],
  );

  const tabs: { id: Tab; label: string; icon: string; count: number }[] = [
    {
      id: "characters",
      label: "Characters",
      icon: "👤",
      count: companions.length,
    },
    {
      id: "images",
      label: "Images",
      icon: "🖼",
      count: unlockedPhotos.length,
    },
    { id: "styles", label: "Styles", icon: "🎨", count: 3 },
  ];

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            🧠 COLLECTION
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Your AI companions, generated images, and style presets.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 p-1 bg-[#13141f] rounded-2xl border border-white/10 mb-8 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              setSelectedCharacter(null);
              setSelectedImage(null);
            }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-candy-gradient text-white shadow-md shadow-pink-500/20"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {tab.icon} {tab.label}{" "}
            <span className="text-xs opacity-60">({tab.count})</span>
          </button>
        ))}
      </div>

      {activeTab === "characters" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
          {companions.map((comp) => (
            <button
              key={comp.id}
              type="button"
              onClick={() => setSelectedCharacter(comp)}
              className="group relative cursor-pointer rounded-3xl overflow-hidden border border-white/10 bg-[#12141e] hover:border-pink-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-pink-500/10 flex flex-col text-left"
            >
              <div className="relative aspect-[3/4] overflow-hidden bg-gray-900">
                <img
                  src={comp.avatarUrl}
                  alt={comp.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                <div className="absolute top-3 right-3">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      comp.isOnline
                        ? "bg-emerald-400/20 text-emerald-300"
                        : "bg-gray-500/20 text-gray-400"
                    }`}
                  >
                    {comp.isOnline ? "● Online" : "○ Offline"}
                  </span>
                </div>
                <div className="absolute bottom-3 left-3 right-3">
                  <h3 className="text-white font-bold text-lg">{comp.name}</h3>
                  <p className="text-xs text-pink-300 mt-0.5">{comp.tagline}</p>
                </div>
              </div>

              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">
                    Age: {comp.age} · {comp.occupation}
                  </span>
                  <span className="text-gray-500">Stage: {comp.stage}</span>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {comp.personality.slice(0, 2).map((p) => (
                    <span
                      key={p}
                      className="px-2 py-0.5 bg-white/5 rounded text-[10px] text-gray-300"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {activeTab === "images" && (
        <div className="columns-2 sm:columns-3 md:columns-4 gap-4 sm:gap-6">
          {unlockedPhotos.map((photo) => (
            <div
              key={`${photo.companionName}-${photo.id}`}
              onClick={() => setSelectedImage(photo.url)}
              className="mb-4 break-inside-[200px] cursor-zoom-in rounded-2xl overflow-hidden border border-white/10 hover:border-pink-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-pink-500/10 group"
            >
              <img
                src={photo.url}
                alt={photo.title}
                className="w-full rounded-2xl transition-transform duration-500 group-hover:scale-105"
              />
              <div className="p-2">
                <div className="text-xs font-bold text-white truncate">
                  {photo.title}
                </div>
                <div className="text-[10px] text-pink-300">
                  {photo.companionName}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "styles" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {["Candy Realism", "Anime Elegance", "Cyber Noir"].map(
            (styleName) => (
              <div
                key={styleName}
                className="rounded-3xl border border-white/10 bg-[#12141e] overflow-hidden p-4 flex flex-col"
              >
                <h3 className="text-white font-bold text-lg mb-2">
                  {styleName}
                </h3>
                <p className="text-xs text-gray-400 mb-3 flex-1">
                  Style preset for AI image generation using ComfyUI workflows.
                </p>
                <button
                  type="button"
                  className="px-3 py-2 rounded-xl bg-candy-gradient text-xs font-semibold text-white"
                >
                  Apply Style →
                </button>
              </div>
            ),
          )}
        </div>
      )}

      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
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

      {selectedCharacter && (
        <CharacterDetailView
          companion={selectedCharacter}
          isCustom={isCustomCompanion(selectedCharacter)}
          onEdit={onEdit}
          onDelete={onDelete}
          onClose={() => setSelectedCharacter(null)}
        />
      )}
    </div>
  );
}
