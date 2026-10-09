import { useEffect, useState } from "react";
import { AIHub } from "@/lib/ai-hub";
import { ComfyUIClient } from "@/lib/comfyui-client";
import type { CandyCompanion } from "@/data/candyPresets";

interface Props {
  isOpen: boolean;
  editingCompanion?: CandyCompanion | null;
  onClose: () => void;
  onCreate: (newCompanion: CandyCompanion) => void;
  onUpdate?: (updatedCompanion: CandyCompanion) => void;
}

export function CreateCompanionModal({
  isOpen,
  editingCompanion = null,
  onClose,
  onCreate,
  onUpdate,
}: Props) {
  const isEditing = editingCompanion !== null;
  const [name, setName] = useState("");
  const [age, setAge] = useState(22);
  const [category, setCategory] = useState<"realistic" | "anime">("realistic");
  const [gender, setGender] = useState<"female" | "male">("female");
  const [personality, setPersonality] = useState("Sweet, Playful, Caring");
  const [occupation, setOccupation] = useState("College Student");
  const [relationship, setRelationship] = useState("Close Friend");
  const [bio, setBio] = useState("");
  const [greeting, setGreeting] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [imagePrompt, setImagePrompt] = useState("");
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  // Prefill the form when editing an existing companion.
  useEffect(() => {
    if (!editingCompanion) return;
    setName(editingCompanion.name);
    setAge(editingCompanion.age);
    setCategory(editingCompanion.category);
    setGender(editingCompanion.gender);
    setPersonality(editingCompanion.personality.join(", "));
    setOccupation(editingCompanion.occupation);
    setRelationship(editingCompanion.relationship);
    setBio(editingCompanion.bio);
    setGreeting(editingCompanion.greeting);
    setAvatarUrl(editingCompanion.avatarUrl);
  }, [editingCompanion]);

  if (!isOpen) return null;

  const defaultRealisticImages = [
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=800&auto=format&fit=crop",
  ];

  const defaultAnimeImages = [
    "https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=800&auto=format&fit=crop",
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalAvatar =
      avatarUrl.trim() ||
      (category === "realistic"
        ? defaultRealisticImages[0]
        : defaultAnimeImages[0]);

    const base: CandyCompanion = {
      id: `custom-${Date.now()}`,
      name: name.trim() || "My AI Companion",
      tagline: `Your custom ${category} companion`,
      age: Number(age) || 22,
      category,
      gender,
      isOnline: true,
      hasVoice: true,
      avatarUrl: finalAvatar,
      bio: bio.trim() || "당신만을 위해 생성된 특별한 AI 파트너입니다.",
      relationship,
      occupation,
      hobbies: ["Chatting with you", "Sharing secrets"],
      personality: personality
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      stage: 1,
      greeting:
        greeting.trim() ||
        `반가워요! 저는 ${name || "AI"}라고 해요. 우리 앞으로 친하게 지내요!`,
      voiceAudioUrl:
        "https://assets.mixkit.co/active_storage/sfx/2874/2874-preview.mp3",
      voiceDurationSec: 5,
      gallery: [
        {
          id: `img-${Date.now()}-1`,
          url: finalAvatar,
          title: "First Encounter",
          isUnlocked: true,
          requiredStage: 0,
        },
      ],
      scenarios: [
        {
          id: `sc-custom-1`,
          title: "첫 만남의 설렘",
          description:
            "처음으로 인사를 나누며 서로의 취향을 알아가는 시간입니다.",
          starter: `*${name || "그녀"}가 당신을 바라보며 환하게 미소 짓습니다.* "만나서 정말 반가워요. 오늘 어떤 이야기부터 해볼까요?"`,
          badge: "Intro",
        },
      ],
    };

    if (isEditing && editingCompanion) {
      // Preserve identity & progress-derived fields; only update editable ones.
      const updatedComp: CandyCompanion = {
        ...base,
        id: editingCompanion.id,
        stage: editingCompanion.stage,
        isOnline: editingCompanion.isOnline,
        hasVoice: editingCompanion.hasVoice,
        gallery: base.avatarUrl === editingCompanion.avatarUrl
          ? editingCompanion.gallery
          : base.gallery,
        scenarios: editingCompanion.scenarios?.length
          ? editingCompanion.scenarios
          : base.scenarios,
        voiceAudioUrl: editingCompanion.voiceAudioUrl ?? base.voiceAudioUrl,
        voiceDurationSec:
          editingCompanion.voiceDurationSec ?? base.voiceDurationSec,
      };
      onUpdate?.(updatedComp);
    } else {
      onCreate(base);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-3xl bg-[#13141f] border border-white/10 shadow-2xl p-6 sm:p-8 text-gray-100 my-8">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-white p-2 rounded-xl hover:bg-white/5 transition"
        >
          ✕
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-candy-gradient flex items-center justify-center text-xl text-white shadow-lg shadow-pink-500/30">
            ✨
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">
              {isEditing ? "Edit Your Companion" : "Create Your AI Girlfriend"}
            </h2>
            <p className="text-xs text-gray-400">
              {isEditing
                ? "캐릭터 정보를 수정하고 저장하세요."
                : "Candy.ai 스타일로 나만의 맞춤형 캐릭터를 만들어보세요."}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          {/* Style Selection */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wider">
              Style Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCategory("realistic")}
                className={`p-3 rounded-2xl border flex items-center justify-center gap-2 font-semibold transition ${
                  category === "realistic"
                    ? "bg-pink-500/20 border-pink-500 text-pink-300 shadow-md shadow-pink-500/20"
                    : "bg-white/[0.03] border-white/10 text-gray-400 hover:text-white"
                }`}
              >
                <span>💃</span> Realistic (실사)
              </button>
              <button
                type="button"
                onClick={() => setCategory("anime")}
                className={`p-3 rounded-2xl border flex items-center justify-center gap-2 font-semibold transition ${
                  category === "anime"
                    ? "bg-pink-500/20 border-pink-500 text-pink-300 shadow-md shadow-pink-500/20"
                    : "bg-white/[0.03] border-white/10 text-gray-400 hover:text-white"
                }`}
              >
                <span>🌸</span> Anime (애니)
              </button>
            </div>
          </div>

          {/* Gender Selection */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wider">
              Gender
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setGender("female")}
                className={`p-3 rounded-2xl border flex items-center justify-center gap-2 font-semibold transition ${
                  gender === "female"
                    ? "bg-pink-500/20 border-pink-500 text-pink-300 shadow-md shadow-pink-500/20"
                    : "bg-white/[0.03] border-white/10 text-gray-400 hover:text-white"
                }`}
              >
                <span>♀️</span> Female
              </button>
              <button
                type="button"
                onClick={() => setGender("male")}
                className={`p-3 rounded-2xl border flex items-center justify-center gap-2 font-semibold transition ${
                  gender === "male"
                    ? "bg-pink-500/20 border-pink-500 text-pink-300 shadow-md shadow-pink-500/20"
                    : "bg-white/[0.03] border-white/10 text-gray-400 hover:text-white"
                }`}
              >
                <span>♂️</span> Male
              </button>
            </div>
          </div>

          {/* Name & Age */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Character Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Scarlett, 수아, Hana"
                className="w-full bg-[#1b1c2b] border border-white/10 rounded-xl px-3.5 py-2.5 text-white placeholder:text-gray-500 focus:outline-none focus:border-pink-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Age
              </label>
              <input
                type="number"
                min={19}
                max={60}
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
                className="w-full bg-[#1b1c2b] border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-pink-500"
              />
            </div>
          </div>

          {/* Avatar Image URL & Quick Picker */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Avatar Image URL (or pick below)
            </label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-[#1b1c2b] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-pink-500 mb-2"
            />
            <div className="flex gap-2">
              {(category === "realistic"
                ? defaultRealisticImages
                : defaultAnimeImages
              ).map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setAvatarUrl(img)}
                  className={`w-12 h-12 rounded-xl overflow-hidden border-2 transition ${
                    avatarUrl === img
                      ? "border-pink-500 scale-105"
                      : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                >
                  <img
                    src={img}
                    alt="pick"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Occupation & Relationship */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Occupation
              </label>
              <input
                type="text"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                placeholder="e.g. Model, Streamer, Student"
                className="w-full bg-[#1b1c2b] border border-white/10 rounded-xl px-3.5 py-2.5 text-white placeholder:text-gray-500 focus:outline-none focus:border-pink-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Relationship
              </label>
              <input
                type="text"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                placeholder="e.g. Close Friend, Secret Partner"
                className="w-full bg-[#1b1c2b] border border-white/10 rounded-xl px-3.5 py-2.5 text-white placeholder:text-gray-500 focus:outline-none focus:border-pink-500"
              />
            </div>
          </div>

          {/* Personality Tags */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Personality Traits (comma separated)
            </label>
            <input
              type="text"
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              placeholder="Warm, Flirty, Shy, Clingy"
              className="w-full bg-[#1b1c2b] border border-white/10 rounded-xl px-3.5 py-2.5 text-white placeholder:text-gray-500 focus:outline-none focus:border-pink-500"
            />
          </div>

          {/* Occupation & Relationship */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Occupation
              </label>
              <input
                type="text"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                placeholder="e.g. Model, Artist"
                className="w-full bg-[#1b1c2b] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-pink-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Relationship
              </label>
              <input
                type="text"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                placeholder="e.g. Best Friend, Lover"
                className="w-full bg-[#1b1c2b] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-pink-500"
              />
            </div>
          </div>

          {/* Bio & Greeting */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Character Bio
            </label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="캐릭터의 성격이나 배경 이야기..."
              className="w-full bg-[#1b1c2b] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-pink-500 resize-none mb-3"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Greeting Message
            </label>
            <textarea
              rows={2}
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              placeholder="처음 나를 만났을 때 건넬 첫마디..."
              className="w-full bg-[#1b1c2b] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-pink-500 resize-none"
            />
          </div>

          {/* AI Image Generation */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              AI Image Prompt
            </label>
            <textarea
              rows={2}
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              placeholder="e.g. Photorealistic portrait of a 23-year-old woman, soft lighting, cinematic..."
              className="w-full bg-[#1b1c2b] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-pink-500 resize-none mb-2"
            />
            <button
              type="button"
              onClick={async () => {
                setIsGenerating(true);
                setGenError("");
                try {
                  const comfyui = new ComfyUIClient();
                  const status = await comfyui.getStatus();
                  if (!status.online) {
                    setGenError(
                      "ComfyUI is not running. Install ComfyUI and restart.",
                    );
                    return;
                  }
                  const aiHub = new AIHub();
                  aiHub.setComfyUIClient(comfyui);
                  const workflow = aiHub.createWorkflow(
                    "new-companion",
                    "Companion Portrait",
                    {
                      prompt:
                        imagePrompt ||
                        `Portrait of ${name || "a character"}, photorealistic, cinematic lighting`,
                      negativePrompt: "worst quality, blurry, deformed",
                      width: 512,
                      height: 768,
                      steps: 20,
                      cfg: 7,
                      sampler: "euler",
                    },
                  );
                  if (!workflow) {
                    setGenError("Could not create workflow");
                    return;
                  }
                  const result = await aiHub.generateImage(
                    "new-companion",
                    workflow,
                  );
                  if ("error" in result) {
                    setGenError(result.error);
                    return;
                  }
                  const image = await aiHub.waitForImage(result.jobId, 60000);
                  if (image) {
                    setGeneratedImages([...generatedImages, image.url]);
                    setAvatarUrl(image.url);
                  } else {
                    setGenError("Image generation timed out");
                  }
                } catch (err) {
                  setGenError(err instanceof Error ? err.message : "Error");
                } finally {
                  setIsGenerating(false);
                }
              }}
              disabled={isGenerating}
              className="w-full py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-400/30 text-cyan-200 font-medium text-xs hover:bg-cyan-500/20 transition disabled:opacity-50"
            >
              {isGenerating ? "🧠 Generating..." : "Generate AI Portrait"}
            </button>
            {genError && (
              <p className="text-[10px] text-rose-300 mt-1">{genError}</p>
            )}
            {generatedImages.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-3">
                {generatedImages.map((img, i) => (
                  <img
                    key={`gen-${i}`}
                    src={img}
                    alt={`Generated ${i + 1}`}
                    onClick={() => setAvatarUrl(img)}
                    className={`rounded-xl aspect-[3/4] object-cover cursor-pointer border-2 transition ${
                      avatarUrl === img
                        ? "border-pink-500 scale-105"
                        : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-candy-gradient hover:bg-candy-gradient-hover text-white font-bold text-sm shadow-xl shadow-pink-500/20 transition-all transform hover:-translate-y-0.5"
            >
              {isEditing ? "💾 Save Changes" : "✨ Generate & Start Chatting"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
