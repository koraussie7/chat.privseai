// @vitest-environment jsdom

afterEach(() => {
	vi.unstubAllGlobals();
});
import { afterEach, describe, expect, it, vi } from "vitest";
/**
 * Tests for guest trial chat logic (Phase 3).
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useGuestChat } from "@/lib/guest-chat";
import type { CharacterCard } from "@/types/character";

const CARD: CharacterCard = {
	spec: "chara_card_v2",
	data: {
		name: "Luna",
		description: "A witty astronomer.",
		personality: "Curious, playful",
		scenario: "Observatory at midnight.",
		first_mes: "Look, the Perseids!",
		system_prompt: "Stay in character as Luna.",
		tags: ["astronomy"],
	},
} as unknown as CharacterCard;

function jsonResponse(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

describe("useGuestChat", () => {
	it("sends a message and tracks remaining count", async () => {
		const fetchMock = vi.fn()
			.mockImplementation(async () => {
					const r = jsonResponse({ reply: "Look up! Tiramisu is rising.", remaining: 2 });
				return r;
			});
		vi.stubGlobal("fetch", fetchMock);
		const { result } = renderHook(() => useGuestChat(CARD));
		expect(result.current.canChat).toBe(true);
		await act(async () => {
			await result.current.send("Hi Luna!");
		});
		await waitFor(
			() => {
				if (result.current.error) throw new Error(`hook error: ${result.current.error}`);
				expect(result.current.messages).toHaveLength(2);
			},
			{ timeout: 5000 },
		);
		expect(result.current.messages[1].content).toContain("Tiramisu");
		expect(result.current.remaining).toBe(2);
		expect(result.current.limitReached).toBe(false);
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://api.privseai.com/v1/prompt/analyze");
		const body = JSON.parse(init.body as string);
		expect(body.task).toBe("guest-chat");
		expect(body.messages[0].content).toContain("You are Luna");
	});

	it("flags limit reached on 429 and blocks further sends", async () => {
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: "guest trial limit reached (3 messages). Sign up for more." }, 429));
		vi.stubGlobal("fetch", fetchMock);
		const { result } = renderHook(() => useGuestChat(CARD));
		await act(async () => {
			await result.current.send("hello");
		});
		await waitFor(() => expect(result.current.busy).toBe(false));
		expect(result.current.limitReached).toBe(true);
		expect(result.current.canChat).toBe(false);
	});

	it("surfaces provider errors without crashing", async () => {
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: "free pool unavailable" }, 502));
		vi.stubGlobal("fetch", fetchMock);
		fetchMock.mockName("guest-err-mock");
		const { result } = renderHook(() => useGuestChat(CARD));
		await act(async () => {
			await result.current.send("hello");
		});
		await waitFor(() => expect(result.current.busy).toBe(false));
		expect(result.current.error).toContain("free pool unavailable");
		expect(result.current.limitReached).toBe(false);
	});

	it("includes recent history (last 4) in the payload", async () => {
		const fetchMock = vi.fn()
			.mockResolvedValueOnce(jsonResponse({ reply: "ok", remaining: 2 }))
			.mockResolvedValueOnce(jsonResponse({ reply: "ok", remaining: 1 }))
			.mockResolvedValueOnce(jsonResponse({ reply: "ok", remaining: 0 }));
		vi.stubGlobal("fetch", fetchMock);
		const { result } = renderHook(() => useGuestChat(CARD));
		for (const text of ["one", "two", "three"]) {
			await act(async () => {
				await result.current.send(text);
			});
			await waitFor(() => !result.current.busy);
		}
		const body = JSON.parse((fetchMock.mock.calls[2] as [string, RequestInit])[1].body as string);
		// system + last 4 (2 pairs) + new user = messages length 7
		expect(body.messages.length).toBeLessThanOrEqual(7);
		expect(body.messages.at(-1).content).toContain("three");
	});
});
