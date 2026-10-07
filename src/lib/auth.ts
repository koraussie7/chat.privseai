import { API_URL } from "@/lib/config";

export interface QuotaInfo {
	limit: number;
	used: number;
	remaining: number;
}

export interface MeResponse {
	user: {
		id: string;
		email: string;
		name: string;
		picture?: string;
	};
	quota: QuotaInfo;
}

export async function fetchMe(): Promise<MeResponse | null> {
	try {
		const res = await fetch(`${API_URL}/auth/me`, { credentials: "include" });
		if (!res.ok) return null;
		return (await res.json()) as MeResponse;
	} catch {
		return null;
	}
}

export function loginUrl(provider: "google" | "github") {
	return `${API_URL}/auth/${provider}`;
}

export async function logout() {
	await fetch(`${API_URL}/auth/logout`, {
		method: "POST",
		credentials: "include",
	});
}
