// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MyNeuroPanel } from "@/components/MyNeuroPanel";
import { MemosSyncPanel } from "@/components/MemosSyncPanel";
import { TTSButton } from "@/components/TTSButton";
import { MyNeuroPage } from "@/pages/MyNeuroPage";

/**
 * Component tests for the my-neuro integration UI.
 *
 * Covers rendering, the import/export flow, TTS consent gating, and the
 * Memos sync button — the pieces the adapter unit tests don't touch.
 */

const companion = {
	id: "luna-01",
	name: "Luna",
	tagline: "nocturnal artist",
	age: 23,
	category: "realistic" as const,
	gender: "female" as const,
	isOnline: true,
	hasVoice: true,
	avatarUrl: "/images/companions/luna-1.jpg",
	bio: "A painter who loves the night sky.",
	relationship: "Close Friend",
	occupation: "Illustrator",
	hobbies: ["stargazing"],
	personality: ["Warm", "Playful"],
	stage: 2,
	greeting: "Hi, I was waiting for you.",
	voiceAudioUrl: "/audio/luna-ref.mp3",
	gallery: [],
	scenarios: [],
} as unknown as Parameters<typeof MyNeuroPanel>[0]["companion"];

beforeEach(() => {
	// jsdom in this vitest setup has no origin, so localStorage is absent.
	// Provide a minimal in-memory shim so the panels' persistence works.
	if (typeof globalThis.localStorage === "undefined") {
		const store = new Map<string, string>();
		Object.defineProperty(globalThis, "localStorage", {
			configurable: true,
			value: {
				getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
				setItem: (k: string, v: string) => void store.set(k, String(v)),
				removeItem: (k: string) => void store.delete(k),
				clear: () => store.clear(),
				key: (i: number) => Array.from(store.keys())[i] ?? null,
				get length() {
					return store.size;
				},
			},
		});
	}
	// jsdom lacks these; add them without replacing the global URL object.
	if (!URL.createObjectURL) {
		URL.createObjectURL = vi.fn(() => "blob:mock") as unknown as typeof URL.createObjectURL;
	}
	if (!URL.revokeObjectURL) {
		URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
	}
});

afterEach(() => {
	cleanup();
	localStorage.clear();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("MyNeuroPanel", () => {
	it("disables export when no companion is selected", () => {
		render(<MyNeuroPanel companion={null} />);
		const btn = screen.getByRole("button", { name: /Export/i }) as HTMLButtonElement;
		expect(btn.disabled).toBe(true);
	});

	it("exports a companion profile without contacting the network", () => {
		const anchorClick = vi.fn();
		const createElement = document.createElement.bind(document);
		vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
			const el = createElement(tag);
			if (tag === "a") el.click = anchorClick;
			return el;
		});
		const fetchSpy = vi.fn();
		vi.stubGlobal("fetch", fetchSpy);

		render(<MyNeuroPanel companion={companion} />);
		fireEvent.click(screen.getByRole("button", { name: /Export Luna/i }));

		expect(anchorClick).toHaveBeenCalled();
		expect(fetchSpy).not.toHaveBeenCalled();
		expect(screen.getByRole("status").textContent).toContain("Exported Luna");
	});

	it("rejects an invalid imported profile", async () => {
		render(<MyNeuroPanel companion={companion} />);
		const input = document.querySelector('input[type="file"]') as HTMLInputElement;
		const file = new File([JSON.stringify({ name: "X", age: 999 })], "bad.json", {
			type: "application/json",
		});
		fireEvent.change(input, { target: { files: [file] } });

		await waitFor(() => {
			expect(screen.getByRole("status").textContent).toMatch(/Invalid profile/i);
		});
	});

	it("imports a valid profile and persists it", async () => {
		const onImported = vi.fn();
		render(<MyNeuroPanel companion={companion} onImported={onImported} />);
		const input = document.querySelector('input[type="file"]') as HTMLInputElement;
		const profile = {
			name: "Rin",
			prompts: { system: "You are Rin. Personality: cynical, witty." },
		};
		const file = new File([JSON.stringify(profile)], "rin.json", {
			type: "application/json",
		});
		fireEvent.change(input, { target: { files: [file] } });

		await waitFor(() => {
			expect(onImported).toHaveBeenCalled();
		});
		const stored = JSON.parse(localStorage.getItem("privsei.myneuro.imported") ?? "[]");
		expect(stored).toHaveLength(1);
		expect(stored[0].name).toBe("Rin");
	});
});

describe("TTSButton consent gating", () => {
	it("does not synthesize without consent", async () => {
		const fetchSpy = vi.fn();
		vi.stubGlobal("fetch", fetchSpy);
		render(<TTSButton text="hello" companionName="Luna" />);

		fireEvent.click(screen.getByRole("button"));

		await waitFor(() => {
			expect(screen.getByTitle(/Enable TTS in Settings first/i)).toBeTruthy();
		});
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("synthesizes when consent is recorded", async () => {
		localStorage.setItem("privsei.tts.consent", "true");
		const audio = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/wav" });
		const fetchSpy = vi.fn().mockResolvedValue(new Response(audio, { status: 200 }));
		vi.stubGlobal("fetch", fetchSpy);
		vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);

		render(<TTSButton text="hello" companionName="Luna" />);
		fireEvent.click(screen.getByRole("button"));

		await waitFor(() => {
			expect(fetchSpy).toHaveBeenCalled();
		});
		const [url] = fetchSpy.mock.calls[0] as [string];
		expect(url).toContain("/api/tts");
	});
});

describe("MemosSyncPanel", () => {
	it("renders the sync form with defaults", () => {
		render(<MemosSyncPanel companionId="luna-01" />);
		expect((screen.getByLabelText(/Server URL/i) as HTMLInputElement).value).toBe(
			"http://127.0.0.1:8081",
		);
		expect((screen.getByLabelText(/Namespace/i) as HTMLInputElement).value).toBe("luna-01");
	});

	it("saves settings to localStorage", () => {
		render(<MemosSyncPanel companionId="luna-01" />);
		fireEvent.change(screen.getByLabelText(/Server URL/i), {
			target: { value: "http://127.0.0.1:9999" },
		});
		fireEvent.click(screen.getByRole("button", { name: /Save settings/i }));
		const saved = JSON.parse(localStorage.getItem("privsei.memos.config") ?? "{}");
		expect(saved.endpoint).toBe("http://127.0.0.1:9999");
	});

	it("reports a sync error instead of throwing", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connection refused")));
		render(<MemosSyncPanel companionId="luna-01" />);
		fireEvent.click(screen.getByRole("button", { name: /Sync now/i }));

		await waitFor(() => {
			expect(screen.getByRole("status").textContent).toMatch(/network|refused/i);
		});
	});
});

describe("MyNeuroPage", () => {
	it("renders the bridge heading and both panels", () => {
		render(<MyNeuroPage />);
		expect(screen.getByText(/Desktop companion bridge/i)).toBeTruthy();
		expect(screen.getByText(/my-neuro Interop/i)).toBeTruthy();
		expect(screen.getByText(/Memory Sync \(Memos\)/i)).toBeTruthy();
	});

	it("lists companions in the export picker", () => {
		render(<MyNeuroPage />);
		const select = screen.getByLabelText(/Companion to export/i) as HTMLSelectElement;
		expect(select.options.length).toBeGreaterThan(1);
	});
});
