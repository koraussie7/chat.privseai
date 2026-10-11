export const APP_NAME = "PrivseAI";
export const APP_URL =
	(import.meta as { env?: { VITE_PUBLIC_APP_URL?: string } }).env?.VITE_PUBLIC_APP_URL ??
	"https://privseai.com";
export const API_URL =
	(import.meta as { env?: { VITE_PUBLIC_API_URL?: string } }).env?.VITE_PUBLIC_API_URL ??
	"https://api.privseai.com";

// Chat completions can be routed through a DIFFERENT base than auth. In local
// dev this points at the same-origin Vite proxy (/api/openai) so the OpenAI key
// stays server-side and CORS is avoided, while auth (/auth/me, login, logout)
// keeps hitting the real privseai API above. Falls back to API_URL when unset.
export const CHAT_API_URL =
	(import.meta as { env?: { VITE_CHAT_API_URL?: string } }).env?.VITE_CHAT_API_URL ??
	API_URL;
export const TRYSTERO_STRATEGY =
	(import.meta as { env?: { VITE_TRYSTERO_STRATEGY?: string } }).env?.VITE_TRYSTERO_STRATEGY ??
	"nostr";
export const TRYSTERO_APP_ID =
	(import.meta as { env?: { VITE_TRYSTERO_APP_ID?: string } }).env?.VITE_TRYSTERO_APP_ID ??
	"privseai-p2pclaw";

// Nostr relays used by Trystero for WebRTC signaling. Set VITE_NOSTR_RELAYS to a
// comma-separated list to point signaling at your own relays.
//
// The fallback list deliberately EXCLUDES relays whose TLS certificates have
// expired: bendernostur.duckdns.org:8443, 0x-nostr-relay.fly.dev and
// cdn.satellite.earth. One unreachable relay in the list stalls the whole
// signaling handshake, which silently keeps the P2P mesh offline.
export const NOSTR_RELAYS = (
	(import.meta as { env?: { VITE_NOSTR_RELAYS?: string } }).env?.VITE_NOSTR_RELAYS ?? ""
)
	.split(",")
	.map((url) => url.trim())
	.filter((url) => url.length > 0);

export const NOSTR_RELAY_FALLBACKS = [
	"wss://nos.lol",
	"wss://nostr.rblb.it",
	"wss://relay.nostrmap.net",
	"wss://nostr.red5d.dev",
	"wss://nostr.stakey.net",
	"wss://nostrcity-club.fly.dev",
	"wss://relay.aarpia.com",
];

/** Relay list to hand to Trystero: the env override wins when non-empty. */
export function resolveNostrRelays(): string[] {
	return NOSTR_RELAYS.length > 0 ? NOSTR_RELAYS : NOSTR_RELAY_FALLBACKS;
}

// ── Colibri / Fellowship inference node ──
// The Fellowship node serves the Colibri WASM inference API on this origin.
// `ColibriWASMClient` reads the same variable as its default base URL.
export const FELLOWSHIP_URL =
	(import.meta as { env?: { VITE_FELLOWSHIP_URL?: string } }).env?.VITE_FELLOWSHIP_URL ??
	"http://localhost:3001";

// Advertising this peer's Colibri gateway to the P2P mesh is opt-in: peers can
// only use an endpoint they can actually reach, so broadcasting a localhost URL
// is pure noise (CandyChatPage filters localhost peers out).
export const COLIBRI_ADVERT_ENABLED =
	(import.meta as { env?: { VITE_COLIBRI_ADVERT_ENABLED?: string } }).env
		?.VITE_COLIBRI_ADVERT_ENABLED === "true";

export const COLIBRI_ADVERT_INTERVAL_MS =
	Number(
		(import.meta as { env?: { VITE_COLIBRI_ADVERT_INTERVAL_MS?: string } }).env
			?.VITE_COLIBRI_ADVERT_INTERVAL_MS,
	) || 60_000;

// Signaling strategy is defined above (TRYSTERO_STRATEGY / TRYSTERO_APP_ID) and
// is kept as a plain string; trystero-client.ts narrows it to `TrysteroStrategy`.

export const REGION =
	(import.meta as { env?: { VITE_REGION?: string } }).env?.VITE_REGION ?? "global";

export const MAIN_ROUTE = "/";
export const CHAT_ROUTE = "/";
export const COMPANIONS_ROUTE = "/companions";
export const SETTINGS_ROUTE = "/settings";
export const WORLD_ROUTE = "/world";

export function api(path: string) {
	const base = API_URL.replace(/\/$/, "");
	const p = path.startsWith("/") ? path : `/${path}`;
	return `${base}${p}`;
}

// Same as api() but targets CHAT_API_URL (the OpenAI dev proxy in local dev).
export function chatApi(path: string) {
	const base = CHAT_API_URL.replace(/\/$/, "");
	const p = path.startsWith("/") ? path : `/${path}`;
	return `${base}${p}`;
}

export const FREE_DAILY_QUOTA = 20;

// freellmpool quota-gateway base. Default: same-origin `/freellm` (Caddy
// proxies it to the gateway on the 110 server). Override for local dev, e.g.
// VITE_QUOTA_GATEWAY_URL=http://127.0.0.1:4005 — must include the path
// prefix the gateway serves under (no trailing slash).
export const QUOTA_GATEWAY_URL =
	(import.meta as { env?: { VITE_QUOTA_GATEWAY_URL?: string } }).env
		?.VITE_QUOTA_GATEWAY_URL ?? "/freellm";

export function quotaGatewayUrl(): string {
	return QUOTA_GATEWAY_URL.replace(/\/$/, "");
}
