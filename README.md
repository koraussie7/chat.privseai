# privseai-trystero

Trystero P2P signaling layer integration for privseai.com — bridges the muhanai `agentmesh` data pipeline (PythiaConnector → LocalCrabAdapter → Fellowship) with Trystero's WebRTC-based P2P transport.

## Architecture

```
                  ┌─────────────────────────────────────┐
                  │     privseai.com (P2P social)       │
                  │                                     │
                  │  ┌──────────┐    ┌──────────┐       │
                  │  │ Browser  │◄──►│ Browser  │       │
                  │  │ Peer A   │    │ Peer B   │       │
                  │  └────┬─────┘    └────┬─────┘       │
                  └──────┼──────────────┼──────────────┘
                         │ WebRTC (Trystero)
                         │
                         ▼
              ┌──────────────────────┐
              │  TrysteroP2PClient   │
              │  (src/lib/)          │
              │                      │
              │  - event-feed        │
              │  - forecast-update   │
              │  - impact-alert      │
              │  - metrics-broadcast │
              │  - task-event        │
              └──────────┬───────────┘
                         │ WebRTC DataChannel
                         ▼
              ┌──────────────────────┐
              │ ColibriWASMClient    │
              │ (src/lib/)           │
              │                      │
              │ Fellowship API:      │
              │  /api/generate       │
              │  /api/models         │
              │  /api/status         │
              │  /api/network        │
              │  /api/memory/sync    │
              └──────────┬───────────┘
                         │ HTTP
                         ▼
              ┌──────────────────────┐
              │  Fellowship Node     │
              │  (Docker/WASM)       │
              │                      │
              │  colibri_wasm.wasm   │
              │  GLM-5.2 744B        │
              └──────────────────────┘
```

## Room Actions

All actions use Trystero's encrypted pubsub room named `p2pclaw:{tenant}:{project}:{task}` for isolation:

| Action | Direction | Payload | Purpose |
|--------|-----------|---------|---------|
| `event-feed` | Broadcast | `PythiaEvent` | Pythia connector event stream |
| `forecast-update` | Broadcast | `PythiaForecast` | Agent forecast predictions |
| `impact-alert` | Broadcast | `ImpactAnalysis` | High-impact event notifications |
| `metrics-broadcast` | Broadcast | `ColibriMetrics` | Real-time WASM inference metrics |
| `task-event` | Request/Response | `TaskEvent` | Agent task lifecycle coordination |

## Components

| Component | File | Description |
|-----------|------|-------------|
| `WorldCockpit` | `src/components/WorldCockpit.tsx` | Network metrics dashboard, peer table, impact heatmap |
| `LiveEvents` | `src/components/LiveEvents.tsx` | Real-time event/forecast/impact feed with broadcast |
| `ImpactAnalysis` | `src/components/ImpactAnalysis.tsx` | Tier distribution, agent rankings, impact list |
| `EvidenceExplorer` | `src/components/EvidenceExplorer.tsx` | Impact alert → evidence chain with Colibri metrics |
| `ForecastLedger` | `src/components/ForecastLedger.tsx` | Colibri inference form + forecast tracking table |

## Hooks

| Hook | File | Description |
|------|------|-------------|
| `useTrystero` | `src/hooks/useTrysteroP2P.ts` | P2P client lifecycle, event state |
| `useColibri` | `src/hooks/useTrysteroP2P.ts` | Fellowship API state |
| `useNetworkPoll` | `src/hooks/useTrysteroP2P.ts` | Metrics polling every 2s |

## Development

```bash
# Install (from parent muhanai project for shared deps)
npm install

# Run tests (vitest)
npx vitest run

# Run dev server
npm run dev

# Build
npm run build

# Typecheck
npx tsc --noEmit
```

## Configuration

### `.env`

```
VITE_FELLOWSHIP_URL=http://localhost:3001
VITE_TRYSTERO_STRATEGY=nostr
VITE_TRYSTERO_APP_ID=privseai-p2pclaw
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_FELLOWSHIP_URL` | `http://localhost:3001` | Fellowship node API URL |
| `VITE_TRYSTERO_STRATEGY` | `nostr` | Trystero signaling strategy |
| `VITE_TRYSTERO_APP_ID` | `privseai-p2pclaw` | Application ID for room isolation |
