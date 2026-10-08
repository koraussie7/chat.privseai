import { useState, useRef, useEffect } from "react";
import type { CandyCompanion } from "@/data/candyPresets";

export interface CandyMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  type?: "text" | "voice" | "selfie";
  mediaUrl?: string;
  audioDuration?: number;
}

interface Props {
  companion: CandyCompanion;
  companions: CandyCompanion[];
  onSelectCompanion: (id: string) => void;
  onSendMessage: (text: string) => Promise<string>;
  onStageProgress?: (newStage: number) => void;
}

const STAGE_TITLES = [
  "Stranger",
  "Acquaintance",
  "Close Friend",
  "Flirty Partner",
  "Sweetheart",
  "Intimate Soulmate",
];

const GIFTS = [
  { id: "rose", name: "Red Rose", icon: "🌹", cost: "Free", exp: 20 },
  { id: "chocolate", name: "Chocolates", icon: "🍫", cost: "Free", exp: 35 },
  { id: "perfume", name: "Luxury Perfume", icon: "💎", cost: "Free", exp: 60 },
  { id: "ring", name: "Diamond Ring", icon: "💍", cost: "Free", exp: 120 },
];

export function CandyChat({
  companion,
  companions,
  onSelectCompanion,
  onSendMessage,
  onStageProgress,
}: Props) {
  const [messages, setMessages] = useState<CandyMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"about" | "gallery" | "scenarios">(
    "about",
  );
  const [activeScenario, setActiveScenario] = useState<string | null>(null);

  // Lightbox state for selfies
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Audio player state
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Relationship affinity progress: restore the saved stage on chat re-entry.
  const progressKey = "privseai_candy_relationship_progress";
  const [affinity, setAffinity] = useState<number>(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem(progressKey) || "{}",
      ) as Record<string, { stage?: number }>;
      return (
        Math.max(companion.stage, saved[companion.id]?.stage ?? 0) * 100 + 40
      );
    } catch {
      return companion.stage * 100 + 40;
    }
  });
  const currentStage = Math.min(
    Math.floor(affinity / 100),
    STAGE_TITLES.length - 1,
  );
  const stageProgress = affinity % 100;

  // Gift fly animation
  const [giftAnimation, setGiftAnimation] = useState<string | null>(null);

  const updateAffinity = (amount: number) => {
    setAffinity((current) => {
      const next = current + amount;
      const nextStage = Math.min(
        Math.floor(next / 100),
        STAGE_TITLES.length - 1,
      );
      if (nextStage > currentStage) onStageProgress?.(nextStage);
      return next;
    });
  };

  const bottomRef = useRef<HTMLDivElement>(null);

  // Initialize messages with companion greeting and voice note
  useEffect(() => {
    const initial: CandyMessage[] = [
      {
        id: `greet-${companion.id}`,
        role: "assistant",
        content: companion.greeting,
        timestamp: new Date().toISOString(),
        type: "text",
      },
    ];

    if (companion.hasVoice && companion.voiceAudioUrl) {
      initial.push({
        id: `voice-${companion.id}`,
        role: "assistant",
        content: "🎙️ 음성 메시지를 보냈습니다.",
        timestamp: new Date().toISOString(),
        type: "voice",
        mediaUrl: companion.voiceAudioUrl,
        audioDuration: companion.voiceDurationSec || 5,
      });
    }

    setMessages(initial);
    try {
      const saved = JSON.parse(
        localStorage.getItem(progressKey) || "{}",
      ) as Record<string, { stage?: number }>;
      setAffinity(
        Math.max(companion.stage, saved[companion.id]?.stage ?? 0) * 100 + 40,
      );
    } catch {
      setAffinity(companion.stage * 100 + 40);
    }
  }, [companion]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText || input).trim();
    if (!text || isTyping) return;

    const userMsg: CandyMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
      type: "text",
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!overrideText) setInput("");
    setIsTyping(true);

    // Boost affinity
    const newAffinity = affinity + 10;
    setAffinity(newAffinity);
    const newStage = Math.min(
      Math.floor(newAffinity / 100),
      STAGE_TITLES.length - 1,
    );
    if (newStage !== currentStage) {
      onStageProgress?.(newStage);
    }

    try {
      const reply = await onSendMessage(text);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: reply,
          timestamp: new Date().toISOString(),
          type: "text",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "잠시 통신이 원활하지 않아요. 다시 말해줄래?",
          timestamp: new Date().toISOString(),
          type: "text",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  // Request Selfie action (Candy.ai feature)
  const handleRequestSelfie = () => {
    if (isTyping) return;
    const requestText = "📸 자기야, 지금 뭐하고 있어? 예쁜 셀카 한 장 보내줘!";

    const userMsg: CandyMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: requestText,
      timestamp: new Date().toISOString(),
      type: "text",
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    setTimeout(() => {
      // Find an available gallery picture
      const photo = companion.gallery[
        Math.floor(Math.random() * companion.gallery.length)
      ] || {
        url: companion.avatarUrl,
        title: "Selfie for you",
      };

      const selfieMsg: CandyMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "방금 널 위해서 찍었어… 어때? 마음에 들어? 💕",
        timestamp: new Date().toISOString(),
        type: "selfie",
        mediaUrl: photo.url,
      };
      setMessages((prev) => [...prev, selfieMsg]);
      setIsTyping(false);
      updateAffinity(25);
    }, 1800);
  };

  // Send Voice Note action
  const handleRequestVoice = () => {
    if (isTyping) return;
    const userMsg: CandyMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: "🎙️ 목소리 듣고 싶어. 음성 메시지 남겨줄래?",
      timestamp: new Date().toISOString(),
      type: "text",
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    setTimeout(() => {
      const voiceMsg: CandyMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "헤헤, 네가 듣고 싶다고 해서 바로 녹음했어! 얼른 들어봐 🎧",
        timestamp: new Date().toISOString(),
        type: "voice",
        mediaUrl:
          companion.voiceAudioUrl ||
          "https://assets.mixkit.co/active_storage/sfx/2874/2874-preview.mp3",
        audioDuration: companion.voiceDurationSec || 5,
      };
      setMessages((prev) => [...prev, voiceMsg]);
      setIsTyping(false);
      updateAffinity(20);
    }, 1500);
  };

  // Play voice
  const togglePlayAudio = (id: string, url: string) => {
    if (playingAudioId === id) {
      audioRef.current?.pause();
      setPlayingAudioId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.play();
      setPlayingAudioId(id);
      audio.onended = () => {
        setPlayingAudioId(null);
      };
    }
  };

  // Send Gift
  const handleSendGift = (gift: (typeof GIFTS)[0]) => {
    setGiftAnimation(gift.icon);
    updateAffinity(gift.exp);

    const userMsg: CandyMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: `🎁 ${gift.name} (${gift.icon}) 선물을 보냈습니다!`,
      timestamp: new Date().toISOString(),
      type: "text",
    };
    setMessages((prev) => [...prev, userMsg]);

    setTimeout(() => {
      setGiftAnimation(null);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `세상에… ${gift.name}이라니 너무 감동이야! 정말 고마워, 사랑해! 🥰❤️`,
          timestamp: new Date().toISOString(),
          type: "text",
        },
      ]);
    }, 1200);
  };

  return (
    <div className="flex h-full w-full min-h-0 bg-[#0b0c10] text-gray-100 overflow-hidden relative">
      {/* Gift Animation Pop */}
      {giftAnimation && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="text-8xl animate-bounce drop-shadow-[0_0_35px_rgba(236,72,153,0.8)]">
            {giftAnimation}
          </div>
        </div>
      )}

      {/* Left Mini / Chat Switcher Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-white/10 bg-[#10121a]">
        <div className="p-4 border-b border-white/10">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Active Chats ({companions.length})
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {companions.map((c) => {
            const isSelected = c.id === companion.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelectCompanion(c.id)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-2xl text-left transition ${
                  isSelected
                    ? "bg-pink-500/15 border border-pink-500/40 shadow-sm shadow-pink-500/10"
                    : "hover:bg-white/[0.04] border border-transparent"
                }`}
              >
                <div className="relative w-11 h-11 shrink-0">
                  <img
                    src={c.avatarUrl}
                    alt={c.name}
                    className="w-full h-full rounded-2xl object-cover ring-1 ring-white/10"
                  />
                  {c.isOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-[#10121a]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white truncate">
                      {c.name}
                    </span>
                    <span className="text-[10px] text-pink-400 font-semibold">
                      {c.category}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 truncate">
                    {c.tagline || c.bio}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Center: Main Immersive Chat View */}
      <section className="flex-1 min-w-0 flex flex-col bg-[#0b0c10] relative">
        {/* Top Chat Bar */}
        <header className="h-16 shrink-0 border-b border-white/10 bg-[#10121a]/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-20">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="relative cursor-pointer shrink-0"
              onClick={() => setDrawerOpen((prev) => !prev)}
            >
              <img
                src={companion.avatarUrl}
                alt={companion.name}
                className="w-10 h-10 rounded-2xl object-cover ring-2 ring-pink-500/40 shadow-md shadow-pink-500/20"
              />
              {companion.isOnline && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-[#10121a]" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white truncate">
                  {companion.name}
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-semibold border border-pink-500/30">
                  LV {currentStage + 1} • {STAGE_TITLES[currentStage]}
                </span>
              </div>
              <p className="text-xs text-emerald-400 flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Online now • Ready to chat
              </p>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2">
            {/* Affinity Stage Progress Bar (Compact) */}
            <div className="hidden sm:flex flex-col items-end mr-2">
              <div className="text-[11px] font-semibold text-pink-300">
                Affinity {stageProgress}%
              </div>
              <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-candy-gradient rounded-full transition-all duration-500"
                  style={{ width: `${stageProgress}%` }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setDrawerOpen((prev) => !prev)}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition border border-white/5"
              title="Toggle Character Profile"
            >
              <span className="text-lg">ℹ️</span>
            </button>
          </div>
        </header>

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Scenario Starter Callout if Active */}
          {activeScenario && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-pink-900/30 to-purple-900/30 border border-pink-500/30 mb-2 flex items-center justify-between">
              <div className="text-xs text-pink-200">
                <span className="font-bold mr-2">🎭 Active Scenario:</span>{" "}
                {activeScenario}
              </div>
              <button
                type="button"
                onClick={() => setActiveScenario(null)}
                className="text-xs text-gray-400 hover:text-white underline ml-2"
              >
                End
              </button>
            </div>
          )}

          {messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id}
                className={`flex items-end gap-3 ${isUser ? "justify-end" : "justify-start"}`}
              >
                {!isUser && (
                  <img
                    src={companion.avatarUrl}
                    alt={companion.name}
                    className="w-8 h-8 rounded-xl object-cover shrink-0 ring-1 ring-white/10"
                  />
                )}

                <div
                  className={`max-w-[85%] sm:max-w-[70%] rounded-3xl p-4 text-sm leading-relaxed shadow-lg ${
                    isUser
                      ? "bg-candy-gradient text-white rounded-br-none shadow-pink-500/10"
                      : "bg-[#161824] border border-white/10 text-gray-100 rounded-bl-none shadow-black/20"
                  }`}
                >
                  {/* Voice Note Message */}
                  {msg.type === "voice" && (
                    <div className="mb-2">
                      <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-black/30 border border-white/10">
                        <button
                          type="button"
                          onClick={() =>
                            togglePlayAudio(
                              msg.id,
                              msg.mediaUrl || companion.voiceAudioUrl || "",
                            )
                          }
                          className="w-9 h-9 rounded-full bg-candy-gradient flex items-center justify-center text-white shadow-md shadow-pink-500/30 shrink-0"
                        >
                          {playingAudioId === msg.id ? "⏸" : "▶"}
                        </button>
                        <div className="flex-1">
                          <div className="flex items-center gap-1 h-4">
                            {[40, 75, 30, 90, 60, 45, 80, 50, 70, 35, 60].map(
                              (h, i) => (
                                <span
                                  key={i}
                                  className={`w-1 rounded-full ${
                                    playingAudioId === msg.id
                                      ? "bg-pink-400 animate-pulse"
                                      : "bg-gray-500"
                                  }`}
                                  style={{ height: `${h}%` }}
                                />
                              ),
                            )}
                          </div>
                          <div className="text-[10px] text-pink-300 font-medium mt-1">
                            Voice Memo • 00:0{msg.audioDuration || 5}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Selfie Image Attachment */}
                  {msg.type === "selfie" && msg.mediaUrl && (
                    <div className="mb-3 rounded-2xl overflow-hidden border border-white/15 relative group">
                      <img
                        src={msg.mediaUrl}
                        alt="Sent selfie"
                        className="w-full max-h-80 object-cover cursor-pointer transition transform group-hover:scale-102"
                        onClick={() => setSelectedImage(msg.mediaUrl || null)}
                      />
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] text-white">
                        🔍 Click to enlarge
                      </div>
                    </div>
                  )}

                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  <div
                    className={`text-[10px] mt-1.5 flex items-center justify-end ${
                      isUser ? "text-pink-200/80" : "text-gray-400"
                    }`}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex items-center gap-2 text-xs text-pink-400 pl-11">
              <span className="flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-pink-500 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-pink-500 animate-bounce [animation-delay:0.15s]" />
                <span className="w-2 h-2 rounded-full bg-pink-500 animate-bounce [animation-delay:0.3s]" />
              </span>
              <span className="font-medium">{companion.name} is typing...</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Interactive Actions Tray (Candy.ai Signature Bar) */}
        <div className="shrink-0 border-t border-white/10 bg-[#10121a]/95 backdrop-blur-md p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1 scrollbar-none">
            {/* Quick Action: Request Selfie */}
            <button
              type="button"
              onClick={handleRequestSelfie}
              disabled={isTyping}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-pink-500/15 border border-pink-500/30 text-pink-300 hover:bg-pink-500/25 transition whitespace-nowrap"
            >
              <span>📸</span> Request Selfie
            </button>

            {/* Quick Action: Send Voice Note */}
            {companion.hasVoice && (
              <button
                type="button"
                onClick={handleRequestVoice}
                disabled={isTyping}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-purple-500/15 border border-purple-500/30 text-purple-300 hover:bg-purple-500/25 transition whitespace-nowrap"
              >
                <span>🎙️</span> Voice Note
              </button>
            )}

            {/* Quick Action: Send Gifts */}
            <div className="flex items-center gap-1 bg-white/[0.04] p-0.5 rounded-full border border-white/5">
              {GIFTS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => handleSendGift(g)}
                  className="px-2 py-1 rounded-full text-xs hover:bg-pink-500/20 transition flex items-center gap-1 text-gray-300 hover:text-white"
                  title={`Send ${g.name} (+${g.exp} EXP)`}
                >
                  <span>{g.icon}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Chat Text Input Area */}
          <div className="flex items-end gap-2">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={isTyping}
              placeholder={`Message ${companion.name}... (Enter to send)`}
              className="flex-1 resize-none rounded-2xl bg-[#181a26] border border-white/10 px-4 py-3 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-pink-500/60 max-h-32 transition"
            />
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={isTyping || !input.trim()}
              className="h-11 w-11 rounded-2xl bg-candy-gradient hover:bg-candy-gradient-hover disabled:opacity-40 flex items-center justify-center text-white shadow-lg shadow-pink-500/25 transition shrink-0"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* Right: Character Detailed Profile & Gallery Drawer */}
      {drawerOpen && (
        <aside className="w-80 xl:w-96 shrink-0 border-l border-white/10 bg-[#0e1017] flex flex-col h-full overflow-hidden">
          {/* Profile Header Image with Gradient */}
          <div className="relative aspect-[4/5] w-full shrink-0 overflow-hidden bg-gray-900">
            <img
              src={companion.avatarUrl}
              alt={companion.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0e1017] via-[#0e1017]/30 to-transparent" />
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/80 transition"
            >
              ✕
            </button>
            <div className="absolute bottom-4 left-4 right-4">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                {companion.name},{" "}
                <span className="font-normal text-gray-300">
                  {companion.age}
                </span>
              </h3>
              <p className="text-xs text-pink-300 mt-0.5">
                {companion.occupation}
              </p>
            </div>
          </div>

          {/* Navigation Tabs (About / Gallery / Scenarios) */}
          <div className="flex border-b border-white/10 shrink-0 bg-[#12141e]">
            <button
              type="button"
              onClick={() => setActiveTab("about")}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider text-center transition border-b-2 ${
                activeTab === "about"
                  ? "border-pink-500 text-pink-400 bg-pink-500/5"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              About
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("gallery")}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider text-center transition border-b-2 ${
                activeTab === "gallery"
                  ? "border-pink-500 text-pink-400 bg-pink-500/5"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              Gallery ({companion.gallery.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("scenarios")}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider text-center transition border-b-2 ${
                activeTab === "scenarios"
                  ? "border-pink-500 text-pink-400 bg-pink-500/5"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              Scenarios
            </button>
          </div>

          {/* Drawer Content Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
            {/* TAB 1: ABOUT */}
            {activeTab === "about" && (
              <div className="space-y-4">
                {/* Relationship Level Card */}
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-pink-300">
                      RELATIONSHIP LEVEL
                    </span>
                    <span className="text-xs font-bold text-white">
                      Stage {currentStage + 1}/6
                    </span>
                  </div>
                  <div className="text-base font-extrabold text-white mb-2">
                    {STAGE_TITLES[currentStage]}
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-candy-gradient rounded-full transition-all duration-500"
                      style={{ width: `${stageProgress}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2">
                    대화를 나누거나 선물을 보내면 다음 레벨의 특별한 사진과
                    시나리오가 해금됩니다.
                  </p>
                </div>

                {/* Bio */}
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                    Bio
                  </div>
                  <p className="text-gray-300 text-xs leading-relaxed">
                    {companion.bio}
                  </p>
                </div>

                {/* Personality Tags */}
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                    Personality
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {companion.personality.map((trait) => (
                      <span
                        key={trait}
                        className="px-2.5 py-1 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-300 text-xs font-medium"
                      >
                        {trait}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Hobbies */}
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                    Hobbies & Interests
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {companion.hobbies.map((h) => (
                      <span
                        key={h}
                        className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/5 text-gray-300 text-xs"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: GALLERY */}
            {activeTab === "gallery" && (
              <div className="grid grid-cols-2 gap-2.5">
                {companion.gallery.map((photo) => {
                  const isUnlocked =
                    photo.isUnlocked ||
                    (photo.requiredStage ?? 0) <= currentStage;
                  return (
                    <div
                      key={photo.id}
                      onClick={() => isUnlocked && setSelectedImage(photo.url)}
                      className={`relative aspect-[3/4] rounded-2xl overflow-hidden border border-white/10 ${
                        isUnlocked
                          ? "cursor-pointer group hover:border-pink-500/50"
                          : "cursor-not-allowed bg-black/50"
                      }`}
                    >
                      <img
                        src={photo.url}
                        alt={photo.title}
                        className={`w-full h-full object-cover transition duration-300 ${
                          isUnlocked
                            ? "group-hover:scale-105"
                            : "blur-md grayscale opacity-40"
                        }`}
                      />
                      {!isUnlocked && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center bg-black/60">
                          <span className="text-xl mb-1">🔒</span>
                          <span className="text-[10px] text-pink-300 font-bold">
                            Stage {(photo.requiredStage ?? 0) + 1} Needed
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                        <p className="text-[10px] text-white font-medium truncate">
                          {photo.title}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 3: SCENARIOS / ROLEPLAY */}
            {activeTab === "scenarios" && (
              <div className="space-y-3">
                {companion.scenarios.map((sc) => (
                  <div
                    key={sc.id}
                    className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-pink-500/40 transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-bold text-white text-xs">
                          {sc.title}
                        </h4>
                        {sc.badge && (
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-semibold">
                            {sc.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-[11px] leading-relaxed mb-3">
                        {sc.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveScenario(sc.title);
                        handleSend(sc.starter);
                      }}
                      className="w-full py-2 rounded-xl bg-candy-gradient hover:bg-candy-gradient-hover text-white text-xs font-bold transition shadow-sm shadow-pink-500/20"
                    >
                      🎭 Start This Roleplay
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Lightbox Modal for Enlarge Image */}
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
