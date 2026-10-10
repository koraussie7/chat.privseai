import { CharacterDetailView } from "@/components/CharacterDetailView";
import { CANDY_PRESETS, type CandyCompanion } from "@/data/candyPresets";
import { useAIHub } from "@/hooks/useAIHub";
import { ageVerifier } from "@/lib/age-verification";
import { cacheUploadedImage, deleteCachedUpload, getCachedUploads } from "@/lib/image-cache";
import { useMemo, useState, useEffect, useRef } from "react";
import { StockImageSearch } from "@/components/StockImageSearch";
import { PromptStudio } from "@/components/PromptStudio";

interface Props {
	companions: CandyCompanion[];
	onEdit?: (companion: CandyCompanion) => void;
	onDelete?: (id: string) => void;
}

type Tab = "characters" | "images" | "videos" | "styles";
type UserUpload = { id: string; url: string; title: string; generatedAt: number };

const isCustomCompanion = (companion: CandyCompanion) =>
	!CANDY_PRESETS.some((preset) => preset.id === companion.id);

export function CandyCollection({ companions, onEdit, onDelete }: Props) {
  const { aiHub, tick } = useAIHub();
  const [activeTab, setActiveTab] = useState<Tab>("characters");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageTitle, setSelectedImageTitle] = useState<string>("");
  // Track selection by ID and derive the latest companion so that edits
  // auto-refresh the detail view and deletions auto-close it.
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(
    null,
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [userUploads, setUserUploads] = useState<UserUpload[]>([]);
  const uploadObjectUrls = useRef(new Set<string>());
  const [uploading, setUploading] = useState(false);
  useEffect(() => () => {
    for (const url of uploadObjectUrls.current) URL.revokeObjectURL(url);
    uploadObjectUrls.current.clear();
  }, []);
  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];
    void getCachedUploads().then((items) => {
      if (cancelled) return;
      const restored = items.map((item) => {
        const url = URL.createObjectURL(item.blob);
        objectUrls.push(url);
        return {
          id: item.placeholderUrl.replace(/^upload:/, ""),
          url,
          title: item.title,
          generatedAt: item.generatedAt,
        };
      });
      setUserUploads(restored);
    }).catch((error) => {
      console.error("Failed to restore uploaded images", error);
      if (!cancelled) setUploadError("Saved uploads could not be restored from this browser.");
    });
    return () => {
      cancelled = true;
      for (const url of objectUrls) URL.revokeObjectURL(url);
    };
  }, []);
  const selectedCharacter = useMemo(
    () => companions.find((c) => c.id === selectedCharacterId) ?? null,
    [companions, selectedCharacterId],
  );

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setUploading(true);
    setUploadError(null);
    const added: UserUpload[] = [];
    try {
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        if (file.size > 20 * 1024 * 1024) {
          throw new Error(`${file.name}: image exceeds the 20 MB limit.`);
        }
        const id = typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const generatedAt = Date.now();
        await cacheUploadedImage({
          id,
          title: file.name.replace(/\.[^.]+$/, ""),
          blob: file,
          generatedAt,
        });
        const objectUrl = URL.createObjectURL(file);
        uploadObjectUrls.current.add(objectUrl);
        added.push({
          id,
          url: objectUrl,
          title: file.name.replace(/\.[^.]+$/, ""),
          generatedAt,
        });
      }
      setUserUploads((current) => [...added, ...current]);
      setUploadError(added.length ? null : "Choose one or more image files to upload.");
    } catch (error) {
      for (const item of added) {
        URL.revokeObjectURL(item.url);
        uploadObjectUrls.current.delete(item.url);
      }
      const message = error instanceof Error ? error.message : "Image upload could not be saved.";
      setUploadError(`${message} Check browser storage availability and try again.`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteUpload = async (upload: UserUpload) => {
    try {
      await deleteCachedUpload(upload.id);
      setUserUploads((current) => current.filter((item) => item.id !== upload.id));
      URL.revokeObjectURL(upload.url);
      uploadObjectUrls.current.delete(upload.url);
    } catch {
      setUploadError("Could not delete this saved upload from browser storage.");
    }
  };

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
          isNSFW: g.isNSFW ?? false,
        })),
      ),
    [companions],
  );

  // Show all photos (not just unlocked) in the Images tab
  const unlockedPhotos = useMemo(() => allPhotos.filter((p) => p.isUnlocked), [allPhotos]);
  const lockedPhotos = useMemo(() => allPhotos.filter((p) => !p.isUnlocked), [allPhotos]);

  // NSFW photos (18+ only, gated by age verification)
  const nsfwPhotos = useMemo(() => allPhotos.filter((p) => p.isNSFW), [allPhotos]);

  // Get generated images from AIHub packages
  const generatedImages = useMemo(() => {
    const allImages = aiHub.getAllImages();
    return allImages.map((img) => ({
      id: img.id,
      url: img.url,
      title: img.title,
      companionName: "AI Generated",
      isNSFW: img.isNSFW ?? false,
    }));
  }, [aiHub, tick]);

  // Get generated videos from AIHub packages
  const generatedVideos = useMemo(() => {
    const allVideos = aiHub.getAllVideos();
    return allVideos.map((vid) => ({
      id: vid.id,
      url: vid.url,
      thumbnailUrl: vid.thumbnailUrl,
      title: vid.title,
      companionName: "AI Generated",
      duration: vid.duration,
      isNSFW: vid.isNSFW ?? false,
    }));
  }, [aiHub, tick]);

  // Stock images (Unsplash + Wikimedia) attached to any package via AIHub.
  const stockImages = useMemo(() => {
    const packages = aiHub.getAllPackages();
    const out: { id: string; url: string; title: string; companionName: string; source: string }[] = [];
    for (const pkg of packages) {
      const stock = aiHub.getPackageImagesStock(pkg.id);
      for (const img of stock) {
        const src = (img.metadata?.source as string) ?? 'unknown';
        out.push({
          id: img.id,
          url: img.thumbnailUrl || img.url,
          title: img.title,
          companionName: pkg.metadata?.name ?? 'Companion',
          source: src,
        });
      }
    }
    return out;
  }, [aiHub, tick]);

  // Only images explicitly marked isNSFW in gallery metadata are shown as 18+.
  // Check if user is age-verified for NSFW content
  const [isAgeVerified, setIsAgeVerified] = useState(false);
  useEffect(() => {
    const checkAge = async () => {
      const result = await ageVerifier.checkAge();
      setIsAgeVerified(result.verified);
    };
    checkAge();
  }, []);

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
      count: allPhotos.length + generatedImages.length + stockImages.length + (isAgeVerified ? nsfwPhotos.length : 0),
    },
    {
      id: "videos",
      label: "Videos",
      icon: "🎬",
      count: generatedVideos.length,
    },
    { id: "styles", label: "Styles", icon: "🎨", count: 3 },
  ];


	return (
		<div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto w-full">
			<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
				<div>
					<h1 className="text-2xl sm:text-3xl font-extrabold text-white">🧠 COLLECTION</h1>
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
							setSelectedCharacterId(null);
							setSelectedImage(null);
						}}
						className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
							activeTab === tab.id
								? "bg-candy-gradient text-white shadow-md shadow-pink-500/20"
								: "text-gray-400 hover:text-white hover:bg-white/5"
						}`}
					>
						{tab.icon} {tab.label} <span className="text-xs opacity-60">({tab.count})</span>
					</button>
				))}
			</div>

			{activeTab === "characters" && (
				<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
					{companions.map((comp) => (
						<button
							key={comp.id}
							type="button"
							onClick={() => setSelectedCharacterId(comp.id)}
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
        <div className="flex flex-col gap-4">
          <StockImageSearch />
          <PromptStudio />
          {uploadError && (
            <div className="p-3 bg-rose-500/20 border border-rose-500/50 rounded-xl text-rose-200 text-sm">
              {uploadError}
            </div>
          )}
          <div className="flex gap-2">
            <label className={`px-4 py-2 rounded-xl bg-candy-gradient hover:bg-candy-gradient-hover text-white font-semibold text-sm cursor-pointer flex items-center gap-2 transition-transform ${uploading ? "pointer-events-none opacity-60" : ""}`}>
              {uploading ? "Saving…" : "📁 Upload"}
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          </div>
          <div className="columns-2 sm:columns-3 md:columns-4 gap-4 sm:gap-6">
            {/* NSFW images (18+ only, from character galleries) */}
            {isAgeVerified && nsfwPhotos.map((photo) => (
              <div
                key={`nsfw-photo-${photo.companionId}-${photo.id}`}
                onClick={() => {
                  setSelectedImage(photo.url);
                  setSelectedImageTitle(photo.title);
                }}
                className="mb-4 break-inside-[200px] cursor-zoom-in rounded-2xl overflow-hidden border border-rose-500/30 hover:border-rose-500/60 transition-all duration-300 hover:shadow-xl hover:shadow-rose-500/20 group relative"
              >
                <img
                  src={photo.url}
                  alt={photo.title}
                  className="w-full rounded-2xl transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute top-2 right-2 bg-rose-500/70 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  🔞 NSFW
                </div>
                <div className="p-2">
                  <div className="text-xs font-bold text-white truncate">
                    {photo.title}
                  </div>
                  <div className="text-[10px] text-rose-300">
                    {photo.companionName} · 18+ Only
                  </div>
                </div>
              </div>
            ))}
            {isAgeVerified && nsfwPhotos.length === 0 && (
              <div className="col-span-full rounded-2xl border-white/10 bg-white/[0.03] p-6 text-center text-sm text-slate-400">
                No 18+ images have been added yet. Images appear here only when their gallery metadata explicitly marks them as NSFW.
              </div>
            )}
            {/* Unlocked photos */}
            {unlockedPhotos.map((photo) => (
              <div
                key={`photo-${photo.companionId}-${photo.id}`}
                onClick={() => {
                  setSelectedImage(photo.url);
                  setSelectedImageTitle(photo.title);
                }}
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
            {/* Locked photos (stage-gated) */}
            {lockedPhotos.map((photo) => (
              <div
                key={`locked-${photo.companionId}-${photo.id}`}
                className="mb-4 break-inside-[200px] rounded-2xl overflow-hidden border border-white/10 bg-black/40 group relative"
              >
                <img
                  src={photo.url}
                  alt={photo.title}
                  className="w-full rounded-2xl grayscale opacity-50 blur-sm"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl mb-1">🔒</span>
                  <span className="text-[10px] text-pink-300 font-bold">
                    Stage {(photo.requiredStage ?? 0) + 1} needed
                  </span>
                </div>
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
            {/* Persisted images uploaded in this browser */}
            {userUploads.map((upload) => (
              <div key={`upload-${upload.id}`} className="mb-4 break-inside-[200px] rounded-2xl overflow-hidden border-white/10 group relative">
                <button type="button" onClick={() => { setSelectedImage(upload.url); setSelectedImageTitle(upload.title); }} className="block w-full cursor-zoom-in">
                  <img src={upload.url} alt={upload.title} className="w-full rounded-2xl" />
                  <div className="p-2 text-left text-xs font-bold text-white truncate">{upload.title}</div>
                </button>
                <button type="button" onClick={() => void handleDeleteUpload(upload)} aria-label={`Delete ${upload.title}`} className="absolute top-2 right-2 rounded-full bg-black/70 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100">Delete</button>
              </div>
            ))}
            {/* Generated images */}
            {generatedImages.map((img) => (
              <div
                key={`gen-${img.id}`}
                onClick={() => {
                  setSelectedImage(img.url);
                  setSelectedImageTitle(img.title);
                }}
                className="mb-4 break-inside-[200px] cursor-zoom-in rounded-2xl overflow-hidden border border-white/10 hover:border-pink-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-pink-500/10 group relative"
              >
                <img
                  src={img.url}
                  alt={img.title}
                  className="w-full rounded-2xl transition-transform duration-500 group-hover:scale-105"
                />
                {img.isNSFW && (
                  <div className="absolute top-2 right-2 bg-rose-500/70 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                    🔞 NSFW
                  </div>
                )}
                <div className="p-2">
                  <div className="text-xs font-bold text-white truncate">
                    {img.title}
                  </div>
                  <div className="text-[10px] text-pink-300">
                    {img.companionName}
                  </div>
                </div>
              </div>
            ))}
            {/* Stock images (Unsplash / Wikimedia) — ToS-safe, marked with source badge */}
            {stockImages.map((img) => (
              <div
                key={`stock-${img.id}`}
                onClick={() => {
                  setSelectedImage(img.url);
                  setSelectedImageTitle(img.title);
                }}
                className="mb-4 break-inside-[200px] cursor-zoom-in rounded-2xl overflow-hidden border border-white/10 hover:border-emerald-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/10 group relative"
              >
                <img
                  src={img.url}
                  alt={img.title}
                  className="w-full rounded-2xl transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute top-2 right-2 bg-emerald-500/80 text-white text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full font-bold">
                  {img.source}
                </div>
                <div className="p-2">
                  <div className="text-xs font-bold text-white truncate">{img.title}</div>
                  <div className="text-[10px] text-emerald-300">📦 {img.companionName}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

			{activeTab === "videos" && (
				<div className="columns-2 sm:columns-3 md:columns-4 gap-4 sm:gap-6">
					{generatedVideos.length === 0 ? (
						<div className="col-span-full text-center py-12 text-gray-400">
							<div className="text-4xl mb-2">🎬</div>
							<p className="text-sm">No videos yet.</p>
							<p className="text-xs mt-1 opacity-60">
								Generate short videos from your AI Hub workflows to see them
								here.
							</p>
						</div>
					) : (
						generatedVideos.map((vid) => (
							<div
								key={`vid-${vid.id}`}
								onClick={() => setSelectedImage(vid.url)}
								className="mb-4 break-inside-[200px] cursor-zoom-in rounded-2xl overflow-hidden border border-white/10 hover:border-pink-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-pink-500/10 group relative"
							>
								<img
									src={vid.thumbnailUrl ?? vid.url}
									alt={vid.title}
									className="w-full rounded-2xl transition-transform duration-500 group-hover:scale-105"
								/>
								<div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded">
									{vid.duration}s
								</div>
								{vid.isNSFW && (
									<div className="absolute top-2 right-2 bg-rose-500/70 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
										🔞 NSFW
									</div>
								)}
								<div className="p-2">
									<div className="text-xs font-bold text-white truncate">
										{vid.title}
									</div>
									<div className="text-[10px] text-pink-300">
										{vid.companionName}
									</div>
								</div>
							</div>
						))
					)}
				</div>
			)}

			{activeTab === "styles" && (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
					{["Candy Realism", "Anime Elegance", "Cyber Noir"].map((styleName) => (
						<div
							key={styleName}
							className="rounded-3xl border border-white/10 bg-[#12141e] overflow-hidden p-4 flex flex-col"
						>
							<h3 className="text-white font-bold text-lg mb-2">{styleName}</h3>
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
					))}
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
							alt={selectedImageTitle || "Enlarged"}
							className="rounded-3xl max-h-[85vh] w-auto object-contain border border-white/20 shadow-2xl"
						/>
						{selectedImageTitle && (
							<div className="absolute bottom-4 left-4 bg-black/60 text-white text-xs px-3 py-1 rounded-lg">
								{selectedImageTitle}
							</div>
						)}
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
					onClose={() => setSelectedCharacterId(null)}
				/>
			)}
		</div>
	);
}
