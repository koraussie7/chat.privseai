import { useState } from "react";
import { useAIHub } from "@/hooks/useAIHub";
import { analyzePrompt, PROMPT_ANALYSIS_MODELS, type PromptAnalysisMode } from "@/lib/prompt-analyzer";

/** PromptLab-inspired analysis UI. Analysis itself requires a server proxy route. */
export function PromptStudio() {
  const { aiHub } = useAIHub();
  const [mode, setMode] = useState<PromptAnalysisMode>("enhance-image");
  const [model, setModel] = useState<string>(PROMPT_ANALYSIS_MODELS[0]);
  const [idea, setIdea] = useState("");
  const [image, setImage] = useState<File | undefined>();
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [generationBusy, setGenerationBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [comfyUrl, setComfyUrl] = useState("http://127.0.0.1:8188");
  const [packageId, setPackageId] = useState("");
  const [controller, setController] = useState<AbortController | null>(null);
  const packages = aiHub.getAllPackages();

  const run = async () => {
    setError(""); setNotice(""); setBusy(true);
    const abort = new AbortController(); setController(abort);
    try {
      const output = await analyzePrompt({ mode, endpoint: "https://api.privseai.com/v1/prompt/analyze", model, prompt: idea, image, signal: abort.signal });
      setResult(output.prompt);
    } catch (e) {
      if (!abort.signal.aborted) setError(e instanceof Error ? e.message : "Prompt analysis failed.");
    } finally { setBusy(false); setController(null); }
  };

  const generateImage = async () => {
    if (!result.trim() || !packageId) return;
    setError(""); setNotice(""); setGenerationBusy(true);
    try {
      const workflowClient = aiHub.getComfyUIClient();
      if (!workflowClient) throw new Error("ComfyUI client is not initialized. Configure ComfyUI in AIHub settings first.");
      if (workflowClient.getURL() !== comfyUrl.trim()) throw new Error("The ComfyUI URL does not match the configured AIHub client. Update it in AIHub settings first.");
      const workflow = workflowClient.createWorkflowFromPrompt(`prompt-studio-${Date.now()}`, "Prompt Studio image", { prompt: result });
      const submission = await aiHub.generateImage(packageId, workflow);
      if ("error" in submission) throw new Error(submission.error);
      const image = await aiHub.waitForImage(submission.jobId, packageId, 120000);
      if (!image) throw new Error("ComfyUI job failed, timed out, or returned no image.");
      image.title = result.slice(0, 80);
      image.description = "Generated via Prompt Studio and ComfyUI";
      image.prompt = result;
      image.metadata = { ...(image.metadata ?? {}), source: "comfyui", workflowId: workflow.id };
      setNotice("Image generated and saved to the selected package.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image generation failed.");
    } finally { setGenerationBusy(false); }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(result); setNotice("Prompt copied."); }
    catch { setError("Clipboard access failed. Select and copy the prompt manually."); }
  };
  return (
    <section
      className="rounded-3xl border-white/10 bg-[#0e1017] p-5 mb-6"
      aria-labelledby="prompt-studio-title"
    >
      <div className="mb-4">
        <h2 id="prompt-studio-title" className="text-lg font-bold text-white">
          ✨ Prompt Studio
        </h2>
        <p className="mt-1 text-xs text-gray-400">
          Analyze your image or expand an idea into a prompt, then optionally generate locally with ComfyUI.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          type="button"
          onClick={() => {
            setMode("enhance-image");
            setError("");
          }}
          aria-pressed={mode === "enhance-image"}
          className={`rounded-xl px-3 py-2 text-sm ${mode === "enhance-image" ? "bg-pink-600 text-white" : "bg-white/5 text-gray-300"}`}
        >
          Expand an idea
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("image");
            setError("");
          }}
          aria-pressed={mode === "image"}
          className={`rounded-xl px-3 py-2 text-sm ${mode === "image" ? "bg-pink-600 text-white" : "bg-white/5 text-gray-300"}`}
        >
          Analyze an image
        </button>
      </div>

      <p className="text-[10px] text-amber-200/80 mb-3">Analysis is sent to PrivseAI API using the Gemini key configured on the server. Your selected text or image is transmitted for analysis.</p>
      <label
        className="block text-xs text-gray-300 mb-1"
        htmlFor="prompt-studio-model"
      >
        Gemini model
      </label>
      <select
        id="prompt-studio-model"
        value={model}
        onChange={(e) => setModel(e.target.value)}
        className="w-full rounded-xl bg-[#13141f] border-white/10 px-3 py-2 text-sm text-white mb-3"
      >
        {PROMPT_ANALYSIS_MODELS.map((m) => (
          <option value={m} key={m}>
            {m}
          </option>
        ))}
      </select>

      {mode === "enhance-image" ? (
        <label
          className="block text-xs text-gray-300 mb-3"
          htmlFor="prompt-studio-idea"
        >
          Image idea
          <textarea
            id="prompt-studio-idea"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            maxLength={12000}
            rows={3}
            placeholder="Describe the image you want to create..."
            className="mt-1 w-full rounded-xl bg-[#13141f] border-white/10 px-3 py-2 text-sm text-white placeholder:text-gray-500"
          />
        </label>
      ) : (
        <label
          className="block text-xs text-gray-300 mb-3"
          htmlFor="prompt-studio-image"
        >
          Reference image (JPEG, PNG, WebP; max 10 MB)
          <input
            id="prompt-studio-image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setImage(e.target.files?.[0])}
            className="mt-1 block w-full text-xs text-gray-300"
          />
        </label>
      )}

      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={run}
          disabled={
            busy ||
            (mode === "enhance-image" ? !idea.trim() : !image)
          }
          className="rounded-xl bg-pink-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? "Analyzing…" : "Analyze / Create prompt"}
        </button>
        {busy && (
          <button
            type="button"
            onClick={() => controller?.abort()}
            className="rounded-xl bg-white/10 px-4 py-2 text-sm text-white"
          >
            Cancel
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-300 mb-3">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-emerald-300 mb-3">
          {notice}
        </p>
      )}
      {result && (
        <div>
          <label
            className="block text-xs text-gray-300 mb-1"
            htmlFor="prompt-studio-result"
          >
            Editable prompt
          </label>
          <textarea
            id="prompt-studio-result"
            value={result}
            onChange={(e) => setResult(e.target.value)}
            rows={6}
            maxLength={12000}
            className="w-full rounded-xl bg-[#13141f] border-white/10 px-3 py-2 text-sm text-white"
          />
          <button
            type="button"
            onClick={copy}
            className="mt-2 rounded-xl bg-white/10 px-4 py-2 text-sm text-white"
          >
            Copy prompt
          </button>
          <div className="mt-4 rounded-xl border-white/10 p-3">
            <h3 className="text-sm font-semibold text-white mb-2">Generate on your computer (ComfyUI)</h3>
            <p className="text-[10px] text-gray-400 mb-2">Requires local ComfyUI and the compatible workflow/model. Browser localhost access may be blocked by CORS or browser local-network security; generated image stays on your ComfyUI unless you save it into PrivseAI.</p>
            <label className="block text-xs text-gray-300 mb-1" htmlFor="prompt-studio-comfy-url">ComfyUI URL</label>
            <input id="prompt-studio-comfy-url" value={comfyUrl} onChange={(e) => setComfyUrl(e.target.value)} className="w-full rounded-xl bg-[#13141f] px-3 py-2 text-sm text-white mb-2" />
            <label className="block text-xs text-gray-300 mb-1" htmlFor="prompt-studio-package">Save generated image to</label>
            <select id="prompt-studio-package" value={packageId} onChange={(e) => setPackageId(e.target.value)} className="w-full rounded-xl bg-[#13141f] px-3 py-2 text-sm text-white mb-2">
              <option value="">Choose a companion package…</option>
              {packages.map((pkg) => <option key={pkg.id} value={pkg.id}>{pkg.metadata.name || pkg.id}</option>)}
            </select>
            <button type="button" onClick={generateImage} disabled={generationBusy || !packageId || !result.trim()} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-40">{generationBusy ? "Generating locally…" : "Generate image locally"}</button>
          </div>
        </div>
      )}
    </section>
  );
}
