# P2P Adult AI Chat Free Service — Requirements

## Current State (what's already done)

### Built in privseai-trystero
- Trystero P2P signaling (WebRTC) — src/lib/trystero-client.ts
- Colibri WASM inference bridge — src/lib/colibri-wasm-client.ts
- P2P peer discovery + Colibri gateway — colibri-gateway action
- Candy-style 3-panel chat UI — src/components/CompanionChat.tsx
- Character profiles (Luna, Aria) — src/pages/ChatPage.tsx
- SillyTavern character card import — src/lib/character-card.ts
- Personality engine (6 relationship stages, emotion) — src/lib/personality-engine.ts
- Auth/quota (free tier, 20/day) — src/lib/auth.ts, useAuth.ts
- BYOK (Bring Your Own Key) — ChatPage.tsx byok field
- P2P network status — WorldCockpit.tsx

## Missing Features for P2P Adult AI Chat Free Service

### 1. Adult Content Model Integration
- OpenRouter (Astral-Lynx, EVA-Qwen, etc.) — API cost
- Local GGUF (Nous-Hermes, Kimiko) — P2P distribution
- WebLLM browser local inference

### 2. P2P Model Chunk Distribution
- Split model into chunks, distribute via Trystero
- src/lib/model-distributor.ts (downloads chunks from peers in parallel)

### 3. Group Chat Rooms (multi-user P2P)
- Beyond 1:1 chat to group rooms
- src/hooks/useChatRoom.ts

### 4. Image Generation
- ComfyUI + CLIP for selfies
- P2P relay to GPU peers

### 5. WebRTC Voice Chat
- P2P audio streaming via Trystero WebRTC data channels

### 6. Age Verification + NSFW Filter
- Selfie + ID verification
- Local NSFW keyword/content classifier
- P2P consensus filtering

### 7. Fully Free Tier
- No payment required (current: 20 free/day)
- Options: ad-supported, P2P relay rewards, freemium

### 8. Mobile + Wearable Integration
- React Native app
- MuhanAI Wearable P2P packages for smart glass support

See INTEGRATION_PLAN.md for full details and implementation priority.