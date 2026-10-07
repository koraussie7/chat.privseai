export const APP_NAME = "PrivseAI";
export const APP_URL =
	(import.meta as { env?: { VITE_PUBLIC_APP_URL?: string } }).env?.VITE_PUBLIC_APP_URL ??
	"https://privseai.com";
export const API_URL =
	(import.meta as { env?: { VITE_PUBLIC_API_URL?: string } }).env?.VITE_PUBLIC_API_URL ??
	"https://api.privseai.com";
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

export const FREE_DAILY_QUOTA = 20;
