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
