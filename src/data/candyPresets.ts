export interface CandyCompanion {
  id: string;
  name: string;
  tagline: string;
  age: number;
  category: "realistic" | "anime";
  gender: "female" | "male";
  isOnline: boolean;
  hasVoice: boolean;
  isLive?: boolean;
  isPopular?: boolean;
  avatarUrl: string;
  bannerUrl?: string;
  bio: string;
  relationship: string;
  occupation: string;
  hobbies: string[];
  personality: string[];
  stage: number; // 0: Stranger, 1: Acquaintance, 2: Friend, 3: Close, 4: Partner, 5: Intimate
  greeting: string;
  voiceAudioUrl?: string;
  voiceDurationSec?: number;
  gallery: {
    id: string;
    url: string;
    title: string;
    isUnlocked: boolean;
    requiredStage?: number;
  }[];
  scenarios: {
    id: string;
    title: string;
    description: string;
    starter: string;
    badge?: string;
  }[];
}

import presetsData from "./candyPresets.json";

export const CANDY_PRESETS: CandyCompanion[] = presetsData as CandyCompanion[];
