import { AIPackageCard } from "@/components/AIPackageCard";
import { CANDY_PRESETS, type CandyCompanion } from "@/data/candyPresets";
import { useTrystero } from "@/hooks/useTrysteroP2P";
import { useAIHub } from "@/hooks/useAIHub";
import { CharacterCardParser } from "@/lib/character-card";
import type { AIPackage } from "@/types/ai-package";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const STORAGE_KEY = "privseai_ai_packages";

export function AIHubPage() {
  const aiHub = useAIHub();
  const [packages, setPackages] = useState<AIPackage[]>([]);
  const [savedPackages, setSavedPackages] = useState<AIPackage[]>([]); // Saved clones/remixes.
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeTag, setActiveTag] = useState<string>("all");
  const [selectedPackage, setSelectedPackage] = useState<AIPackage | null>(
    null,
  );
  const [notice, setNotice] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const [showCollection, setShowCollection] = useState(false);
  const [activeTab, setActiveTab] = useState<"discover" | "images">("discover");
  const [isHubReady, setIsHubReady] = useState(false);
  const [comfyuiUrl, setComfyuiUrl] = useState(
    localStorage.getItem("privseai_comfyui_url") || "http://127.0.0.1:8188",
  );
  const [comfyuiStatus, setComfyuiStatus] = useState<{
    online: boolean;
    models: string[];
  } | null>(null);
  const [stylePresets, setStylePresets] = useState<
    import("@/types/ai-package").StylePreset[]
  >(() => [
    {
      id: "candy-realism",
      name: "Candy Realism",
      description: "실사풍 캐릭터 초상화",
      promptTemplate:
        "{name}, {prompt}, photorealistic portrait, warm cinematic light, soft skin detail, elegant and romantic",
    },
    {
      id: "anime-elegance",
      name: "Anime Elegance",
      description: "우아한 애니메이션 스타일",
      promptTemplate:
        "{name}, {prompt}, elegant anime illustration, refined line art, soft colors, detailed eyes",
    },
    {
      id: "cyber-noir",
      name: "Cyber Noir",
      description: "네온 사이버 누아르",
      promptTemplate:
        "{name}, {prompt}, cyber noir portrait, neon rim lighting, cinematic dark city, detailed",
    },
  ]);
  const [selectedStyleId, setSelectedStyleId] = useState("candy-realism");
  const [isGenerating, setIsGenerating] = useState(false);
  const [detailImagePrompt, setDetailImagePrompt] = useState("");
  const navigate = useNavigate();
  const { network, colibriPeers, registerClientReady } = useTrystero();

  useEffect(() => {
    const localPkgs: AIPackage[] = [];

    for (const companion of CANDY_PRESETS) {
      const profile = {
        id: companion.id,
        name: companion.name,
        age: companion.age,
        avatarUrl: companion.avatarUrl,
        gallery: companion.gallery.map((item) => item.url),
        bio: companion.bio,
        relationship: companion.relationship,
        occupation: companion.occupation,
        hobbies: companion.hobbies,
        personality: companion.personality,
        stage: companion.stage,
      };
      const cardData = CharacterCardParser.profileToCard(profile);
      const card = {
        spec: "chara_card_v2" as const,
        data: {
          ...cardData,
          first_mes: companion.greeting,
          creator: "PrivseAI",
          character_version: "1.0",
          src: companion.avatarUrl,
          extensions: {
            ...cardData.extensions,
            stage: companion.stage,
            age: companion.age,
            occupation: companion.occupation,
          },
        },
      };

      const pkg = aiHub.createPackage({
        card,
        description: companion.tagline,
        creator: "PrivseAI",
        baseModel: "Qwen3-0.6B",
        tags: [...(companion.hobbies || []), ...(companion.personality || [])],
        category: companion.category,
        media: {
          avatarUrl: companion.avatarUrl,
          bannerUrl: companion.bannerUrl,
          gallery: companion.gallery?.map((g) => g.url) ?? [],
          voiceId: companion.voiceAudioUrl,
        },
      });
      localPkgs.push(pkg);
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    let parsed: AIPackage[] = [];
    try {
      const value: unknown = saved ? JSON.parse(saved) : [];
      if (Array.isArray(value)) parsed = value as AIPackage[];
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    setSavedPackages(parsed);
    setPackages([...localPkgs, ...parsed]);
    aiHub.loadPackages([...localPkgs, ...parsed]);
    setIsHubReady(true);
  }, [aiHub]);

  useEffect(() => {
    try {
      const savedUrl = localStorage.getItem("privseai_comfyui_url");
      if (savedUrl) aiHub.setComfyUIUrl(savedUrl);
      const savedStyles = localStorage.getItem("privseai_comfyui_styles");
      if (savedStyles) {
        const parsed = JSON.parse(
          savedStyles,
        ) as import("@/types/ai-package").StylePreset[];
        if (Array.isArray(parsed) && parsed.length > 0) setStylePresets(parsed);
      }
    } catch {
      localStorage.removeItem("privseai_comfyui_styles");
    }
  }, [aiHub]);

  useEffect(() => {
    return registerClientReady((client) => {
      aiHub.setClient(client);
      const unsubscribe = client.onAIPackage((data, peerId) => {
        const incoming = data as AIPackage;
        if (!incoming?.id || incoming.spec !== "ai-package-v1") return;
        aiHub.receivePackage(incoming, peerId);
        setPackages((current) => {
          const existing = current.find((pkg) => pkg.id === incoming.id);
          if (existing) return current;
          setNotice({
            kind: "success",
            text: `Received ${incoming.metadata.name} from the P2P network.`,
          });
          return [...current, incoming];
        });
      });
      return unsubscribe;
    });
  }, [aiHub, registerClientReady]);
  useEffect(() => {
    if (!isHubReady) return;
    const refresh = window.setInterval(() => {
      setPackages((current) => {
        const known = new Set(current.map((pkg) => pkg.id));
        return [
          ...current,
          ...aiHub.getAllPackages().filter((pkg) => !known.has(pkg.id)),
        ];
      });
    }, 1500);
    return () => window.clearInterval(refresh);
  }, [aiHub, isHubReady]);
  useEffect(() => {
    if (!isHubReady) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedPackages));
  }, [isHubReady, savedPackages]);
  useEffect(() => {
    if (!selectedPackage) return;
    const latest = packages.find((pkg) => pkg.id === selectedPackage.id);
    if (latest && latest !== selectedPackage) setSelectedPackage(latest);
  }, [packages, selectedPackage]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedPackage(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const stats = useMemo(
    () => ({
      totalPackages: packages.length,
      totalPeers: network?.peerCount ?? 0,
      cachedModels: aiHub.getStats().cachedModels,
    }),
    [aiHub, network?.peerCount, packages.length],
  );

  const visiblePackages = showCollection ? savedPackages : packages;
  const filtered = visiblePackages.filter((pkg) => {
    if (activeCategory !== "all" && pkg.metadata.category !== activeCategory)
      return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = pkg.metadata.name.toLowerCase().includes(q);
      const matchDesc = pkg.metadata.description.toLowerCase().includes(q);
      const matchTag = pkg.metadata.tags.some((t) =>
        t.toLowerCase().includes(q),
      );
      const matchCreator = pkg.metadata.creator.toLowerCase().includes(q);
      const matchTool = pkg.tools.some((t) => t.name.toLowerCase().includes(q));
      if (!matchName && !matchDesc && !matchTag && !matchCreator && !matchTool)
        return false;
    }
    if (activeTag !== "all") {
      if (!pkg.metadata.tags.includes(activeTag)) return false;
    }
    return true;
  });

  const persistPackage = (pkg: AIPackage) => {
    setPackages((current) =>
      current.some((item) => item.id === pkg.id) ? current : [...current, pkg],
    );
    setSavedPackages((current) => {
      const next = current.some((item) => item.id === pkg.id)
        ? current
        : [...current, pkg];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const persistGeneratedImage = (
    pkg: AIPackage,
    image: import("@/types/ai-package").ImageAsset,
  ) => {
    const existing = packages.find((item) => item.id === pkg.id) ?? pkg;
    const updated: AIPackage = {
      ...existing,
      media: {
        ...existing.media,
        avatarUrl: existing.media.avatarUrl || image.url,
        images: [
          ...(existing.media.images ?? []).filter(
            (item) => item.id !== image.id,
          ),
          image,
        ],
        gallery: Array.from(
          new Set([...(existing.media.gallery ?? []), image.url]),
        ),
      },
      galleryItems: [
        ...(existing.galleryItems ?? []).filter((item) => item.id !== image.id),
        {
          id: image.id,
          type: "image",
          url: image.url,
          thumbnailUrl: image.thumbnailUrl,
          title: image.title,
          description: image.description,
          isUnlocked: true,
          prompt: image.prompt,
          metadata: {
            model: image.model,
            width: image.width,
            height: image.height,
            seed: image.seed,
            workflowId: image.workflowId,
          },
        },
      ],
    };
    aiHub.addImageAsset(pkg.id, image);
    setPackages((current) =>
      current.map((item) => (item.id === pkg.id ? updated : item)),
    );
    setSavedPackages((current) => {
      const next = current.map((item) => (item.id === pkg.id ? updated : item));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setNotice({
      kind: "success",
      text: `Image saved to ${pkg.metadata.name}'s collection.`,
    });
  };

  const handleGenerateForPackage = async (
    pkg: AIPackage,
    prompt: string,
    styleId: string,
  ) => {
    if (!comfyuiStatus?.online) {
      setNotice({
        kind: "error",
        text: "Connect to ComfyUI in the Images tab first. Check server URL and CORS.",
      });
      setActiveTab("images");
      setShowCollection(true);
      return;
    }
    if (!prompt.trim()) {
      setNotice({ kind: "error", text: "Enter an image prompt first." });
      return;
    }
    setIsGenerating(true);
    setNotice(null);
    try {
      const { ComfyUIClient } = await import("@/lib/comfyui-client");
      const client = new ComfyUIClient(comfyuiUrl.trim());
      const status = await client.getStatus();
      setComfyuiStatus(status);
      if (!status.online)
        throw new Error(
          `Can't reach ComfyUI at ${comfyuiUrl}. Check server address and CORS.`,
        );
      const style = stylePresets.find((item) => item.id === styleId);
      const finalPrompt = style
        ? style.promptTemplate
            .replaceAll("{name}", pkg.metadata.name)
            .replaceAll("{prompt}", prompt)
        : prompt;
      const workflow = client.createWorkflowFromPrompt(
        `wf-${pkg.id}-${Date.now()}`,
        `${pkg.metadata.name} portrait`,
        {
          prompt: finalPrompt,
          negativePrompt:
            style?.negativePrompt ||
            "low quality, blurry, malformed hands, text, watermark",
          model:
            style?.model ||
            localStorage.getItem("privseai_comfyui_model") ||
            status.models[0] ||
            "sd_xl_base_1.0.safetensors",
          width: style?.width || 512,
          height: style?.height || 768,
          steps: style?.steps || 20,
          cfg: style?.cfg || 7,
          sampler: style?.sampler || "euler",
        },
      );
      const job = await client.submitWorkflow(workflow);
      if (job.status === "failed")
        throw new Error(job.error || "ComfyUI rejected the workflow.");
      const finished = await client.waitForJob(job.id, 120000);
      if (finished.status !== "completed" || !finished.image)
        throw new Error(finished.error || "Image generation timed out.");
      persistGeneratedImage(pkg, finished.image);
    } catch (error) {
      setNotice({
        kind: "error",
        text:
          error instanceof Error ? error.message : "Image generation failed.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClone = (pkg: AIPackage) => {
    try {
      if (
        savedPackages.some(
          (item) =>
            item.forkedFrom?.id === pkg.id ||
            (item.card.data.name === pkg.card.data.name &&
              item.metadata.creator === "You"),
        )
      ) {
        setNotice({
          kind: "error",
          text: "This package is already in your collection.",
        });
        return;
      }
      const cloned = aiHub.clonePackage(pkg, { creator: "You" });
      persistPackage(cloned);
      setSelectedPackage(null);
      setNotice({
        kind: "success",
        text: `${cloned.metadata.name} added to your AI Hub.`,
      });
    } catch (error) {
      setNotice({
        kind: "error",
        text:
          error instanceof Error ? error.message : "Could not clone this AI.",
      });
    }
  };

  const handleRemix = (pkg: AIPackage) => {
    try {
      const remixed = aiHub.forkPackage(pkg, "You", {
        name: `${pkg.metadata.name} (My Remix)`,
        systemPrompt: `You are ${pkg.metadata.name}, but with a cheekier attitude. ${pkg.config.systemPrompt || ""}`,
      });
      persistPackage(remixed);
      setSelectedPackage(remixed);
      setNotice({
        kind: "success",
        text: `${remixed.metadata.name} remix created.`,
      });
    } catch (error) {
      setNotice({
        kind: "error",
        text:
          error instanceof Error ? error.message : "Could not create a remix.",
      });
    }
  };

  const handleChat = (pkg: AIPackage) => {
    const profile = aiHub.packageToProfile(pkg);
    const companion: CandyCompanion = {
      id: pkg.id,
      name: profile.name,
      tagline: pkg.metadata.description,
      age: Number(profile.age) || 22,
      category: pkg.metadata.category === "anime" ? "anime" : "realistic",
      gender: "female",
      isOnline: true,
      hasVoice: Boolean(pkg.media.voiceId),
      avatarUrl: pkg.media.avatarUrl || pkg.card.data.src || "",
      bio: profile.bio || pkg.metadata.description,
      relationship: profile.relationship || "친구",
      occupation: profile.occupation || "AI 동반자",
      hobbies: profile.hobbies ?? [],
      personality: profile.personality ?? [],
      stage: profile.stage ?? 2,
      greeting:
        pkg.card.data.first_mes || `안녕, 나는 ${profile.name}이야. 반가워!`,
      voiceAudioUrl: pkg.media.voiceId,
      gallery: (pkg.media.gallery ?? []).map((url, index) => ({
        id: `${pkg.id}-gallery-${index}`,
        url,
        title: `${profile.name} 갤러리 ${index + 1}`,
        isUnlocked: true,
      })),
      scenarios: [],
    };
    try {
      const stored = JSON.parse(
        localStorage.getItem("privseai_candy_custom_companions") || "[]",
      ) as CandyCompanion[];
      localStorage.setItem(
        "privseai_candy_custom_companions",
        JSON.stringify([
          ...stored.filter((item) => item.id !== companion.id),
          companion,
        ]),
      );
    } catch {
      localStorage.setItem(
        "privseai_candy_custom_companions",
        JSON.stringify([companion]),
      );
    }
    navigate(`/chat/${encodeURIComponent(companion.id)}`);
  };

  const handleShare = async (pkg: AIPackage) => {
    const result = await aiHub.sharePackage(pkg);
    if (result.success) {
      const shared = aiHub.getPackage(pkg.id) ?? pkg;
      setNotice({
        kind: "success",
        text: `Shared ${pkg.metadata.name} with ${result.peerId ? "a P2P peer" : "the P2P network"}.`,
      });
      setPackages((current) =>
        current.map((item) => (item.id === pkg.id ? shared : item)),
      );
      setSavedPackages((current) => {
        const next = current.map((item) =>
          item.id === pkg.id ? shared : item,
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
      setSelectedPackage((current) =>
        current?.id === shared.id ? shared : current,
      );
      return;
    }
    setNotice({
      kind: "error",
      text:
        result.error ?? "P2P sharing failed. Connect to the network and retry.",
    });
  };

  const tags = [
    "all",
    "Sensual",
    "Playful",
    "Tsundere",
    "Romantic",
    "Confident",
    "Elegant",
    "Fierce",
    "Realistic",
    "Anime",
  ];

  const categories = ["all", "realistic", "anime", "cyber", "fantasy"];
  const imagePackages = packages.filter(
    (pkg) => (pkg.media.images?.length ?? 0) > 0,
  );
  const checkComfyUI = async () => {
    const { ComfyUIClient } = await import("@/lib/comfyui-client");
    const client = new ComfyUIClient(comfyuiUrl.trim());
    const status = await client.getStatus();
    setComfyuiStatus({ online: status.online, models: status.models });
    if (!status.online) {
      setNotice({
        kind: "error",
        text: `Cannot reach ComfyUI at ${comfyuiUrl}. Check the server address and allow this site's origin in ComfyUI CORS settings.`,
      });
    } else {
      localStorage.setItem("privseai_comfyui_url", comfyuiUrl.trim());
      setNotice({
        kind: "success",
        text: `Connected to ComfyUI at ${comfyuiUrl}.`,
      });
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
      {notice && (
        <div
          aria-live="polite"
          className={`mb-5 flex items-center justify-between rounded-2xl border px-4 py-3 text-sm ${notice.kind === "success" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" : "border-rose-400/20 bg-rose-400/10 text-rose-200"}`}
        >
          <span>
            {notice.kind === "success" ? "✓" : "!"} {notice.text}
          </span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}
      <div className="relative rounded-3xl overflow-hidden mb-8 border border-white/10 bg-gradient-to-r from-purple-950/40 via-cyan-950/30 to-[#0e1017] p-6 sm:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 text-xs font-semibold mb-4">
            <span>🧠</span> AI Hub — P2P Companion Sharing
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Discover & Share <br />
            <span className="candy-text-gradient">AI Companions</span>
          </h1>
          <p className="mt-3 text-sm sm:text-base text-gray-300 max-w-xl leading-relaxed">
            Clone AI companions from peers, remix personalities, and share your
            creations over P2P. Models are distributed via the Trystero mesh —
            no central servers.
          </p>
          <div className="mt-6 flex gap-3">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>🌐</span>
              {stats.totalPeers} peers online
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>📦</span>
              {stats.totalPackages} packages
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>💾</span>
              {stats.cachedModels} cached models
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 p-1 bg-[#13141f] rounded-2xl border border-white/10 self-start sm:self-auto overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                activeCategory === cat
                  ? "bg-candy-gradient text-white shadow-md shadow-cyan-500/20"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {cat === "all"
                ? "🧠 All AIs"
                : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search AIs by name, creator, tools..."
            className="w-full bg-[#13141f] border border-white/10 rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-cyan-500/50"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {activeTab === "images" && (
        <section className="mb-6 rounded-2xl border-cyan-400/15 bg-cyan-400/[0.04] p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <label className="block flex-1 text-xs font-medium text-slate-300">
              ComfyUI server URL
              <input
                value={comfyuiUrl}
                onChange={(event) => {
                  setComfyuiUrl(event.target.value);
                  setComfyuiStatus(null);
                }}
                placeholder="http://127.0.0.1:8188"
                className="mt-1.5 w-full rounded-xl border-white/10 bg-[#13141f] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/50"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                void checkComfyUI();
              }}
              className="rounded-xl border-cyan-300/20 bg-cyan-300/10 px-4 py-2.5 text-sm font-semibold text-cyan-100"
            >
              Check connection
            </button>
            <span
              role="status"
              className={`text-xs ${comfyuiStatus?.online ? "text-emerald-300" : comfyuiStatus ? "text-rose-300" : "text-slate-500"}`}
            >
              {comfyuiStatus
                ? comfyuiStatus.online
                  ? `Connected${comfyuiStatus.models.length ? ` · ${comfyuiStatus.models.length} models` : ""}`
                  : "Not reachable"
                : "Not checked"}
            </span>
          </div>
          {comfyuiStatus?.online && comfyuiStatus.models.length === 0 && (
            <p className="mt-2 text-xs text-amber-200">
              ComfyUI is reachable, but model discovery may require a local
              server extension. Enter the installed checkpoint filename below if
              needed.
            </p>
          )}
          {comfyuiStatus?.online && (
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <select
                value={selectedStyleId}
                onChange={(event) => setSelectedStyleId(event.target.value)}
                className="rounded-xl border-white/10 bg-[#13141f] px-3 py-2.5 text-sm text-white"
                aria-label="Image style"
              >
                {stylePresets.map((style) => (
                  <option key={style.id} value={style.id}>
                    {style.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Checkpoint model"
                value={
                  localStorage.getItem("privseai_comfyui_model") ||
                  comfyuiStatus.models[0] ||
                  "sd_xl_base_1.0.safetensors"
                }
                onChange={(event) =>
                  localStorage.setItem(
                    "privseai_comfyui_model",
                    event.target.value,
                  )
                }
                className="rounded-xl border-white/10 bg-[#13141f] px-3 py-2.5 text-sm text-white"
              >
                {comfyuiStatus.models.length ? (
                  comfyuiStatus.models.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))
                ) : (
                  <option value="sd_xl_base_1.0.safetensors">
                    sd_xl_base_1.0.safetensors
                  </option>
                )}
              </select>
            </div>
          )}
          {!comfyuiStatus?.online && (
            <p className="mt-3 text-xs text-slate-400">
              Once connected, open a character card → ComfyUI Portrait Studio to
              enter a prompt and generate. Browser access needs ComfyUI CORS to
              allow the site origin.
            </p>
          )}
        </section>
      )}
      {activeTab === "images" && imagePackages.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-white">
            Generated image packages
          </h2>
          <div className="flex flex-wrap gap-2">
            {imagePackages.map((pkg) => (
              <button
                key={pkg.id}
                type="button"
                onClick={() => setSelectedPackage(pkg)}
                className="rounded-full border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-200 hover:border-cyan-300/30"
              >
                {pkg.metadata.name} · {pkg.media.images?.length ?? 0}
              </button>
            ))}
          </div>
        </section>
      )}
      {activeTab === "discover" && (
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-4 scrollbar-none">
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(tag)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                activeTag === tag
                  ? "bg-cyan-500/20 border border-cyan-400/50 text-cyan-300"
                  : "bg-white/[0.03] border border-white/5 text-gray-400 hover:text-gray-200 hover:bg-white/[0.07]"
              }`}
            >
              {tag === "all" ? "🔥 All Tags" : `#${tag}`}
            </button>
          ))}
        </div>
      )}

      <div className="mb-6 flex items-center gap-2 border-b border-white/10 pb-3 text-xs text-slate-400">
        <button
          type="button"
          onClick={() => setShowCollection(false)}
          aria-pressed={!showCollection}
          className={`rounded-full px-3 py-1.5 ${showCollection ? "" : "bg-cyan-400/10 text-cyan-200"}`}
        >
          Discover · {packages.length}
        </button>
        <button
          type="button"
          onClick={() => setShowCollection(true)}
          aria-pressed={showCollection}
          className={`rounded-full px-3 py-1.5 ${showCollection ? "bg-cyan-400/10 text-cyan-200" : ""}`}
        >
          My Collection · {savedPackages.length}
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab("images");
            setShowCollection(true);
          }}
          aria-pressed={activeTab === "images"}
          className={`rounded-full px-3 py-1.5 ${activeTab === "images" ? "bg-cyan-400/10 text-cyan-200" : ""}`}
        >
          Generated Images ·{" "}
          {imagePackages.reduce(
            (count, pkg) => count + (pkg.media.images?.length ?? 0),
            0,
          )}
        </button>
        <span className="ml-auto">
          {network?.peerCount ?? 0} peers · {colibriPeers.length} inference
          nodes
        </span>
      </div>
      {!isHubReady ? (
        <div className="py-16 text-center text-sm text-slate-400">
          Loading AI packages…
        </div>
      ) : activeTab === "images" ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {imagePackages.flatMap((pkg) =>
            (pkg.media.images ?? []).map((image) => (
              <button
                key={`${pkg.id}-${image.id}`}
                type="button"
                onClick={() => {
                  setSelectedPackage(pkg);
                  setDetailImagePrompt(image.prompt);
                }}
                className="overflow-hidden rounded-2xl border-white/10 bg-[#12141e] text-left hover:border-cyan-300/30"
              >
                <img
                  src={image.thumbnailUrl || image.url}
                  alt={image.title}
                  className="aspect-[3/4] w-full object-cover"
                />
                <span className="block p-3 text-xs text-slate-200">
                  {pkg.metadata.name} · {image.title}
                </span>
              </button>
            )),
          )}
          {imagePackages.length === 0 && (
            <div className="col-span-full py-16 text-center text-sm text-slate-400">
              Generated portraits will appear here after saving them to a
              character.
            </div>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border-dashed border-white/10 py-16 text-center">
          <div className="mb-3 text-4xl">🧠</div>
          <h2 className="text-lg font-semibold text-white">
            No packages found
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Try another search or category filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((pkg) => (
            <AIPackageCard
              key={pkg.id}
              pkg={pkg}
              onSelect={setSelectedPackage}
              onChat={handleChat}
              onClone={handleClone}
              onRemix={handleRemix}
              onShare={handleShare}
            />
          ))}
        </div>
      )}
      {selectedPackage && (
        <PackageDetailOverlay
          pkg={selectedPackage}
          isGenerating={isGenerating}
          comfyuiOnline={Boolean(comfyuiStatus?.online)}
          prompt={detailImagePrompt}
          onPromptChange={setDetailImagePrompt}
          onGenerateImage={(pkg) =>
            void handleGenerateForPackage(
              pkg,
              detailImagePrompt,
              selectedStyleId,
            )
          }
          onClose={() => setSelectedPackage(null)}
          onChat={handleChat}
          onClone={handleClone}
          onRemix={handleRemix}
          onShare={handleShare}
        />
      )}
    </div>
  );
}

interface PackageDetailOverlayProps {
  pkg: AIPackage;
  isGenerating: boolean;
  comfyuiOnline: boolean;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  onGenerateImage: (pkg: AIPackage) => void;
  onClose: () => void;
  onChat: (pkg: AIPackage) => void;
  onClone: (pkg: AIPackage) => void;
  onRemix: (pkg: AIPackage) => void;
  onShare: (pkg: AIPackage) => void;
}

function PackageDetailOverlay({
  pkg,
  isGenerating,
  comfyuiOnline,
  prompt,
  onPromptChange,
  onGenerateImage,
  onClose,
  onChat,
  onClone,
  onRemix,
  onShare,
}: PackageDetailOverlayProps) {
  const avatar = pkg.media.avatarUrl || pkg.card.data.src || "";
  const tools = pkg.tools || [];

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-3xl w-full rounded-3xl border border-white/10 bg-[#0a101b] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative h-64 sm:h-80">
          <img
            src={avatar}
            alt={pkg.metadata.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a101b] via-transparent to-transparent" />
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white">
                {pkg.metadata.name}
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Created by{" "}
                <span className="text-cyan-300">{pkg.metadata.creator}</span> ·
                Version {pkg.metadata.version} · Base model:{" "}
                {pkg.metadata.baseModel}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-500 hover:text-white text-xl"
            >
              ✕
            </button>
          </div>

          {pkg.metadata.description && (
            <p className="text-sm text-gray-300 leading-relaxed">
              {pkg.metadata.description}
            </p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-cyan-400">
                {pkg.metadata.likeCount}
              </div>
              <div className="text-xs text-gray-500">Likes</div>
            </div>
            <div>
              <div className="text-lg font-bold text-pink-400">
                {pkg.metadata.downloadCount}
              </div>
              <div className="text-xs text-gray-500">Downloads</div>
            </div>
            <div>
              <div className="text-lg font-bold text-purple-400">
                {pkg.metadata.forks}
              </div>
              <div className="text-xs text-gray-500">Forks</div>
            </div>
            <div>
              <div className="text-lg font-bold text-emerald-400">
                {tools.length}
              </div>
              <div className="text-xs text-gray-500">MCP Tools</div>
            </div>
          </div>

          {tools.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-2">
                MCP Tools
              </h3>
              <div className="flex flex-wrap gap-2">
                {tools.map((tool) => (
                  <span
                    key={tool.id}
                    className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/20 text-cyan-300 text-xs"
                  >
                    {tool.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {pkg.card.data.personality && (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-2">
                Personality
              </h3>
              <p className="text-sm text-gray-300 whitespace-pre-line">
                {pkg.card.data.personality}
              </p>
            </div>
          )}

          {pkg.config.systemPrompt && (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-2">
                System Prompt
              </h3>
              <p className="text-xs text-gray-400 whitespace-pre-line bg-[#13141f] p-3 rounded-xl line-clamp-3">
                {pkg.config.systemPrompt}
              </p>
            </div>
          )}

          <section className="space-y-3 rounded-2xl border-cyan-300/15 bg-cyan-300/[0.04] p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  ComfyUI Portrait Studio
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  생성 이미지는 이 캐릭터의 Images collection에 저장됩니다.
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] ${comfyuiOnline ? "bg-emerald-400/10 text-emerald-300" : "bg-slate-400/10 text-slate-400"}`}
              >
                {comfyuiOnline ? "ComfyUI ready" : "Set up in Images tab"}
              </span>
            </div>
            <label className="block text-xs text-slate-300">
              Portrait prompt
              <textarea
                value={prompt}
                onChange={(event) => onPromptChange(event.target.value)}
                rows={3}
                placeholder={`Describe ${pkg.metadata.name}'s portrait...`}
                className="mt-1.5 w-full resize-y rounded-xl border-white/10 bg-[#13141f] px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-cyan-300/50 focus:outline-none"
              />
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                disabled={isGenerating || !comfyuiOnline || !prompt.trim()}
                onClick={() => onGenerateImage(pkg)}
                className="w-full rounded-xl bg-candy-gradient px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isGenerating ? "Generating portrait…" : "✨ Generate portrait"}
              </button>
            </div>
            {(pkg.media.images?.length ?? 0) > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {pkg.media.images?.map((image) => (
                  <img
                    key={image.id}
                    src={image.thumbnailUrl || image.url}
                    alt={image.title}
                    title={image.title}
                    className="aspect-[3/4] w-full rounded-lg object-cover"
                  />
                ))}
              </div>
            )}
          </section>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                onChat(pkg);
                onClose();
              }}
              className="flex-1 py-2.5 rounded-xl bg-candy-gradient text-white font-bold text-sm shadow-lg shadow-cyan-500/20"
            >
              💬 Start Chatting
            </button>
            <button
              type="button"
              onClick={() => {
                onClone(pkg);
                onClose();
              }}
              className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-200 hover:text-white hover:border-cyan-400/50 font-medium text-sm"
            >
              📥 Clone
            </button>
            <button
              type="button"
              onClick={() => {
                onRemix(pkg);
                onClose();
              }}
              className="py-2.5 px-4 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-purple-300 hover:border-purple-400/50"
              title="Remix / Fork"
            >
              🔱 Remix
            </button>
            <button
              type="button"
              onClick={() => onShare(pkg)}
              className="py-2.5 px-4 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-cyan-300 hover:border-cyan-400/50"
              title="Share via P2P"
            >
              🌐 Share
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
