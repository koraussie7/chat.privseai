import { describe, expect, it, vi } from "vitest";
import { analyzePrompt } from "@/lib/prompt-analyzer";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

describe("analyzePrompt", () => {
  it("posts prompt analysis to the PrivseAI server without provider secrets", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ prompt: "A cinematic image prompt" }));
    const result = await analyzePrompt({
      mode: "enhance-image",
      endpoint: "https://api.privseai.com/v1/prompt/analyze",
      model: "gemini-test-model",
      prompt: "moonlit forest",
    }, fetchMock as unknown as typeof fetch);
    expect(result.prompt).toBe("A cinematic image prompt");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.privseai.com/v1/prompt/analyze");
    expect(new Headers(init.headers).has("x-goog-api-key")).toBe(false);
    const body = JSON.parse(init.body as string);
    expect(body.prompt).toBe("moonlit forest");
    expect(body.model).toBe("gemini-test-model");
  });

  it("rejects invalid public endpoint URLs", async () => {
    await expect(analyzePrompt({ mode: "enhance-image", endpoint: "https://api.privseai.com.attacker.example/v1/prompt/analyze", model: "m", prompt: "idea" }))
      .rejects.toMatchObject({ code: "invalid-input" });
  });

  it("validates image type before any network request", async () => {
    const fetchMock = vi.fn();
    const image = new File(["x"], "x.gif", { type: "image/gif" });
    await expect(analyzePrompt({ mode: "image", endpoint: "https://api.privseai.com/v1/prompt/analyze", model: "m", image }, fetchMock as unknown as typeof fetch))
      .rejects.toMatchObject({ code: "invalid-input" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps auth and quota responses", async () => {
    for (const [status, code] of [[403, "unauthorized"], [429, "rate-limited"]] as const) {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, status));
      await expect(analyzePrompt({ mode: "enhance-image", endpoint: "https://api.privseai.com/v1/prompt/analyze", model: "m", prompt: "idea" }, fetchMock as unknown as typeof fetch))
        .rejects.toMatchObject({ code });
    }
  });
});
