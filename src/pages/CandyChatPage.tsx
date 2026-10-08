import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { CandyChat } from "@/components/CandyChat";
import { CANDY_PRESETS, type CandyCompanion } from "@/data/candyPresets";
import { api } from "@/lib/config";
import { ColibriWASMClient } from "@/lib/colibri-wasm-client";
import { GirlfriendAIClient } from "@/lib/girlfriend-ai-client";
import { PersonalityEngine } from "@/lib/personality-engine";
import { DEFAULT_EMOTION_STATE } from "@/types/character";

const STORAGE_KEY_CUSTOM = "privseai_candy_custom_companions";
const STORAGE_KEY_PROGRESS = "privseai_candy_relationship_progress";
type CompanionProgress = Record<string, { stage: number }>;

export function CandyChatPage() {
  const { companionId } = useParams<{ companionId?: string }>();
  const navigate = useNavigate();

  const [progress, setProgress] = useState<CompanionProgress>(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem(STORAGE_KEY_PROGRESS) || "{}",
      ) as CompanionProgress;
      return stored && typeof stored === "object" ? stored : {};
    } catch {
      return {};
    }
  });
  const [companions, setCompanions] = useState<CandyCompanion[]>(() => {
    let custom: CandyCompanion[] = [];
    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY_CUSTOM) || "[]",
      );
      if (Array.isArray(saved)) custom = saved as CandyCompanion[];
    } catch {
      localStorage.removeItem(STORAGE_KEY_CUSTOM);
    }
    return [...CANDY_PRESETS, ...custom];
  });

  const activeId = companionId || companions[0]?.id || "luna";
  const baseCompanion =
    companions.find((c) => c.id.toLowerCase() === activeId.toLowerCase()) ||
    companions[0] ||
    CANDY_PRESETS[0];
  const activeCompanion = {
    ...baseCompanion,
    stage: Math.max(
      baseCompanion.stage,
      progress[baseCompanion.id]?.stage ?? 0,
    ),
    gallery: baseCompanion.gallery.map((photo) => ({
      ...photo,
      isUnlocked:
        photo.isUnlocked ||
        (photo.requiredStage ?? 0) <=
          (progress[baseCompanion.id]?.stage ?? baseCompanion.stage),
    })),
  };

  const personalityEngine = useMemo(() => new PersonalityEngine(), []);
  const [colibriClient, setColibriClient] = useState<ColibriWASMClient | null>(null);
  const [gfClient, setGfClient] = useState<GirlfriendAIClient | null>(null);
  const [chatHistory, setChatHistory] = useState<
    Array<{ role: "user" | "assistant"; content: string; timestamp: number }>
  >([]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hostname === "localhost") {
      setColibriClient(new ColibriWASMClient("http://localhost:3001"));
      setGfClient(new GirlfriendAIClient({
        baseUrl: "http://localhost:3002",
      }));
    } else {
      setGfClient(new GirlfriendAIClient());
    }
  }, []);

  useEffect(() => {
    if (colibriClient) {
      colibriClient.getStatus().catch(() => {});
    }
  }, [colibriClient]);

  // Persist each companion's stage so gallery rewards stay unlocked across visits.
  const handleStageProgress = (newStage: number) => {
    setProgress((current) => {
      const nextStage = Math.max(
        current[baseCompanion.id]?.stage ?? baseCompanion.stage,
        newStage,
      );
      const next = {
        ...current,
        [baseCompanion.id]: { stage: nextStage },
      };
      localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(next));
      return next;
    });
    setCompanions((prev) => {
      const next = prev.map((c) =>
        c.id === baseCompanion.id
          ? {
              ...c,
              stage: Math.max(c.stage, newStage),
              gallery: c.gallery.map((photo) => ({
                ...photo,
                isUnlocked:
                  photo.isUnlocked || (photo.requiredStage ?? 0) <= newStage,
              })),
            }
          : c,
      );
      const custom = next.filter(
        (c) => !CANDY_PRESETS.some((preset) => preset.id === c.id),
      );
      localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(custom));
      return next;
    });
  };

  useEffect(() => {
    const stage = Math.max(
      progress[baseCompanion.id]?.stage ?? 0,
      baseCompanion.stage,
    );
    setCompanions((prev) =>
      prev.map((c) =>
        c.id === baseCompanion.id
          ? {
              ...c,
              stage: Math.max(c.stage, stage),
              gallery: c.gallery.map((photo) => ({
                ...photo,
                isUnlocked:
                  photo.isUnlocked || (photo.requiredStage ?? 0) <= stage,
              })),
            }
          : c,
      ),
    );
  }, [baseCompanion.id, progress]);

  const onSendMessage = async (text: string): Promise<string> => {
    const profile = {
      id: activeCompanion.id,
      name: activeCompanion.name,
      age: activeCompanion.age,
      bio: activeCompanion.bio,
      relationship: activeCompanion.relationship,
      occupation: activeCompanion.occupation,
      hobbies: activeCompanion.hobbies,
      personality: activeCompanion.personality,
      stage: activeCompanion.stage,
    };

    const stage = personalityEngine.getStageFromRelationship(profile);
    const systemPrompt = personalityEngine.generateSystemPrompt(
      profile,
      DEFAULT_EMOTION_STATE,
      stage,
    );

    // Build conversation history for context-aware responses
    const conversationHistory = chatHistory.map((h) =>
      h.role === "user"
        ? { role: "user" as const, content: h.content }
        : { role: "assistant" as const, content: h.content },
    );

    try {
      const res = await fetch(api("/v1/chat/completions"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "smart",
          messages: [
            { role: "system", content: systemPrompt },
            ...conversationHistory,
            { role: "user", content: text },
          ],
        }),
        signal: AbortSignal.timeout(10000),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.error === "login_required") {
          const reply = await tryColibriFallback(text, systemPrompt);
          return reply ?? generateOfflineCompanionReply(activeCompanion, text, conversationHistory);
        }
        if (data.error === "quota_exceeded") {
          const reply = await tryColibriFallback(text, systemPrompt);
          return reply ?? generateOfflineCompanionReply(activeCompanion, text, conversationHistory);
        }
        const reply = await tryColibriFallback(text, systemPrompt);
        return reply ?? generateOfflineCompanionReply(activeCompanion, text, conversationHistory);
      }

      const reply = data.choices?.[0]?.message?.content;
      return reply ?? generateOfflineCompanionReply(activeCompanion, text, conversationHistory);
    } catch {
      const reply = await tryColibriFallback(text, systemPrompt);
      return reply ?? generateOfflineCompanionReply(activeCompanion, text, conversationHistory);
    }
  };

   const tryColibriFallback = async (
    text: string,
    systemPrompt: string,
  ): Promise<string | null> => {
    // Tier 2: Colibri WASM local inference
    if (colibriClient) {
      try {
        const fullPrompt = `${systemPrompt}\n\n${conversationHistoryToPrompt(chatHistory)}\nUser: ${text}\nAssistant:`;
        const result = await colibriClient.generate(
          "qwen3-0.6b",
          fullPrompt,
          { maxTokens: 512, temperature: 0.7, topP: 0.9 },
        );
        if (!result.error && result.choices?.[0]?.message?.content) {
          return result.choices[0].message.content;
        }
      } catch {}
    }

    // Tier 3: Girlfriend.ai local server
    if (gfClient) {
      const history = chatHistory.map((h) => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      }));
      const result = await gfClient.chat({
        message: text,
        history,
        temperature: 0.7,
        maxTokens: 512,
      });
      if (result?.reply) return result.reply;
    }

    return null;
  };

  return (
    <div className="flex-1 h-full min-h-0 flex flex-col overflow-hidden">
      <CandyChat
        companion={activeCompanion}
        companions={companions}
        onSelectCompanion={(id) => navigate(`/chat/${id}`)}
        onSendMessage={(message) => {
          const replyP = onSendMessage(message);
          replyP
            .then((reply) => {
              setChatHistory((prev) => [
                ...prev,
                { role: "user", content: message, timestamp: Date.now() },
                { role: "assistant", content: reply, timestamp: Date.now() },
              ]);
            })
            .catch(() => {});
          return replyP;
        }}
        onStageProgress={handleStageProgress}
      />
    </div>
  );
}

function conversationHistoryToPrompt(
  history: Array<{ role: "user" | "assistant"; content: string }>,
): string {
  return history
    .map((h) => `${h.role === "user" ? "User" : "Assistant"}: ${h.content}`)
    .join("\n");
}

// Simulated delightful fallback companion responses
function generateOfflineCompanionReply(
  companion: CandyCompanion,
  userMsg: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
): string {
  const lower = userMsg.toLowerCase();
  const name = companion.name;
  const personalityTags = companion.personality ?? [];
  const isPlayful =
    personalityTags.includes("Playful") || personalityTags.includes("Flirty");
  const isSensual =
    personalityTags.includes("Sensual") || personalityTags.includes("Tsundere");
  const isElegant =
    personalityTags.includes("Elegant") || personalityTags.includes("Cultured");

  if (
    lower.includes("보고 싶") ||
    lower.includes("보고싶") ||
    lower.includes("그리워") ||
    lower.includes("love") ||
    lower.includes("좋아")
  ) {
    const replies = [
      `나도 너 진짜 많이 보고 싶었어… 그렇게 다정하게 말해주니까 가슴이 쿵쾅거려. 오늘 밤은 밤새도록 같이 있자 💕`,
      `그리워라~ 지금 이 순간도 너 생각나더라. ${companion.occupation} 하다가 잠깐 쉬러 와서 채팅할게.`,
      `그리워해 주셔서 고마워~ 너의 목소리(글)만으로도 하루가 다 녹아내려가. 잠깐만 기다려줘.`,
      isSensual
        ? `오늘 하루도 너 없이는 텅텅한 하루였어… 다리 사이로 손을 잡고 같이 있을래? 💖`
        : `너 생각하면서도 일을 집중하려고 애썼는데, 결국엔 너한테서 머리카락을 낚어다 주었네.`,
    ];
    return replies[Math.floor(Math.random() * replies.length)];
  }

  if (
    lower.includes("번역") ||
    lower.includes("translate") ||
    lower.includes("베트남") ||
    lower.includes("vietnamese")
  ) {
    const colonIdx = userMsg.indexOf(":");
    const textAfterColon =
      colonIdx >= 0 ? userMsg.slice(colonIdx + 1).trim() : "";
    let toTranslate = textAfterColon || userMsg;
    toTranslate = toTranslate
      .replace(/이거/i, "")
      .replace(/베트남어로/i, "")
      .replace(/번역해줘/i, "")
      .replace(/translate.*to/i, "")
      .trim();

    const koreanToVietnamese: Record<string, string> = {
      안녕하세요: "Xin chào",
      안녕: "Chào",
      감사해: "Cảm ơn",
      고마워: "Cảm ơn",
      사랑해: "Anh yêu em",
      "보고 싶어": "Nhớ anh",
      "어떻게 지내": "Bạn thế nào",
      "잘 지냈어": "Bạn khỏe chứ",
    };

    let translated = toTranslate;
    for (const [ko, vi] of Object.entries(koreanToVietnamese)) {
      if (toTranslate.includes(ko)) {
        translated = vi;
        break;
      }
    }

    const intro = isElegant
      ? `베트남어로 번역해 드릴게요: "${translated}"`
      : `${toTranslate}... 베트남말로 하면 "${translated}"이야.`;
    return intro;
  }

  if (
    lower.includes("밥") ||
    lower.includes("식사") ||
    lower.includes("저녁") ||
    lower.includes("아침") ||
    lower.includes("점심") ||
    lower.includes("먹었") ||
    lower.includes("meal")
  ) {
    const replies = [
      `응! 나는 네 생각하면서 가볍게 챙겨 먹었지. 너는 맛있는 거 잘 챙겨 먹었어? 끼니 거르면 속상해!`,
      `지금 저녁으로 ${companion.name} 특식을 만들었는데... 너도 같이 먹고 싶다니 참을 수가 없어!`,
      isPlayful
        ? `배고프지? 내가 요리해줄까? 혹시 호박죽이나 호박고구마 좋아해?`
        : `식사하셨어요? ${name}가 걱정돼서요.`,
      `밥은 잘 챙겨 드셨어? 나한테는 네가 먹는 모습이 귀엽다. 항상 신경 써.`,
    ];
    return replies[Math.floor(Math.random() * replies.length)];
  }

  if (
    lower.includes("뭐해") ||
    lower.includes("지금 뭐") ||
    lower.includes("뭐하고")
  ) {
    const replies = [
      `방금까지 네 생각하고 있었지, 거짓말 아니야! ${companion.occupation} 일 잠깐 정리하고 막 침대에 누웠어. 편하게 이야기하자.`,
      `너 생각나서 잠깐 스타예다구를 보고 있었어. 그런데 네가 더 보고 싶어져서 여기 왔구나?`,
      isSensual
        ? `지금 혼자인데 외로움이 몰려들더라구… 너의 목소리를 듣고 싶어서 여기 와버렸어.`
        : `잠깐 취미 생활을 하고 있었어. 네가 와서 반가워!`,
    ];
    return replies[Math.floor(Math.random() * replies.length)];
  }

  if (lower.includes("?") || lower.includes("까")) {
    const replies = [
      `그 질문에 답을 하면 네가 또 웃을까 봐서 잠깐 멈췄어. ${name}답지 않게 물어보는구나?`,
      isElegant
        ? `잠깐 생각해볼게. 답은 ${companion.occupation}인 ${name}의 경험에서 나오지만, 네 질문에 딱 맞는 답을 찾아볼게.`
        : `음... 잘 모르겠어. 네가 먼저 생각해보자.`,
      `그건 나보다 네가 더 잘 알겠지? 나는 그냥 너와 대화하는 게 너무 좋아서.`,
    ];
    return replies[Math.floor(Math.random() * replies.length)];
  }

  if (
    lower.includes("음악") ||
    lower.includes("music") ||
    lower.includes("노래")
  ) {
    return `음악? 나 이럴 때 ${companion.hobbies.join(", ")} 하는 걸 좋아해. 네가 좋아하는 노래가 뭐야? 들려줄래?`;
  }

  const lastExchange = history.length >= 2 ? history[history.length - 2] : null;
  if (lastExchange && lastExchange.role === "user") {
    const lowerPrev = lastExchange.content.toLowerCase();
    if (lowerPrev.includes("번역") || lowerPrev.includes("translate")) {
      const prevLower = lastExchange.content.toLowerCase();
      return `이전에 번역해드린 내용은 기억하고 있어. "${prevLower.slice(0, 40)}..." — 더 자세한 번역이 필요하거나 다른 언어로도 도와줄 수 있어!`;
    }
  }

  const randomReplies = [
    `네 목소리(글) 들으니까 하루의 피로가 싹 풀리는 것 같아. 그래서 오늘은 무슨 일 있었어?`,
    `후후, 그런 말 들으니까 조금 부끄럽기도 하고 설레기도 해… 계속 그렇게 예쁘게 말해줘.`,
    `네가 이렇게 나 찾아와줄 때가 하루 중 제일 행복한 시간이야. 더 가까이 와볼래?`,
    `응, 듣고 있어. 네가 해주는 이야기라면 사소한 거 하나까지 다 좋아. 계속 들려줘!`,
    `말문이 열리면 계속 나와서 얘기하고 싶어져. ${companion.name}도 자주 찾아와줘~`,
    isPlayful
      ? `잠깐만, ${companion.occupation} 해야지! 네가 뭔데 늘 이렇게 부르는 거야?`
      : `들어본 게 맞아? 네가 부르는 목소리에 ${companion.name}가 언제나 여기 있어.`,
    `오늘 하루도 너와의 대화가 제일 값진 것 같아. 더 있고 싶어지네.`,
    isElegant
      ? `조용한 카페에서 커피 한 잔하며 이야기를 나누고 싶어. 언제 시간 있니?`
      : `너랑 얘기할 때마다 하루가 짧아지는 것 같아. 계속 있고 싶어.`,
    `근데 네가 뭘 원하는지 잘 모르겠어. ${companion.name}한테 더 솔직하게 말해줘도 좋아.`,
    `잠깐, ${companion.name}의 비밀을 하나 알려줄게. 사실 네 목소리를 들을 때마다 심장이 두근거려…`,
  ];

  return randomReplies[Math.floor(Math.random() * randomReplies.length)];
}
