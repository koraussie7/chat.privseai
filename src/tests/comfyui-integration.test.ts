import { AIHub } from "@/lib/ai-hub";
import { CharacterCardParser } from "@/lib/character-card";
import { ComfyUIClient, DEFAULT_WORKFLOW } from "@/lib/comfyui-client";
import type { CharacterCard } from "@/types/character";
import { describe, expect, it } from "vitest";

const makeTestCard = (name = "TestAI"): CharacterCard =>
  CharacterCardParser.createDefaultCard(name);

describe("AIHub ComfyUI integration", () => {
  it("should create a style preset", () => {
    const hub = new AIHub();
    const style = hub.createStylePreset({
      name: "Candy Realism",
      description: "Photorealistic character portraits",
      promptTemplate: "{name} portrait, photorealistic, cinematic lighting",
      negativePrompt: "blurry, low quality",
      model: "sd_xl_base_1.0",
      width: 512,
      height: 768,
      steps: 20,
      cfg: 7,
      tags: ["realistic", "portrait"],
    });

    expect(style.id).toBeDefined();
    expect(style.name).toBe("Candy Realism");
    expect(style.width).toBe(512);
    expect(style.height).toBe(768);
    expect(style.tags).toContain("realistic");
  });

  it("should retrieve style preset by id", () => {
    const hub = new AIHub();
    const style = hub.createStylePreset({
      name: "Anime Elegance",
      description: "Anime-style portraits",
      promptTemplate: "{name} anime style",
    });

    expect(hub.getStylePreset(style.id)).toBeDefined();
    expect(hub.getStylePreset(style.id)?.name).toBe("Anime Elegance");
    expect(hub.getStylePreset("nonexistent")).toBeUndefined();
  });

  it("should get all style presets", () => {
    const hub = new AIHub();
    hub.createStylePreset({
      name: "Style 1",
      description: "Test 1",
      promptTemplate: "test",
    });
    hub.createStylePreset({
      name: "Style 2",
      description: "Test 2",
      promptTemplate: "test",
    });

    expect(hub.getAllStylePresets()).toHaveLength(2);
  });

  it("should create a workflow from a style preset", () => {
    const hub = new AIHub();
    hub.setComfyUIClient(new ComfyUIClient());

    const style = hub.createStylePreset({
      name: "Test Style",
      description: "Test",
      promptTemplate: "",
    });

    const card = makeTestCard("Luna");
    const pkg = hub.createPackage({
      card,
      creator: "test",
    });

    const workflow = hub.createWorkflow(pkg.id, "Portrait", {
      prompt: "test prompt",
      stylePresetId: style.id,
    });

    expect(workflow).not.toBeNull();
    expect(workflow?.name).toBe("Portrait");
    expect(workflow?.lastPrompt).toBe("test prompt");
  });

  it("should return null when creating workflow without ComfyUI client", () => {
    const hub = new AIHub();

    const card = makeTestCard("Luna");
    const pkg = hub.createPackage({
      card,
      creator: "test",
    });

    const workflow = hub.createWorkflow(pkg.id, "Portrait", {
      prompt: "test prompt",
    });

    expect(workflow).toBeNull();
  });

  it("should get workflows attached to a package", () => {
    const hub = new AIHub();
    hub.setComfyUIClient(new ComfyUIClient());

    const card = makeTestCard("Luna");
    const pkg = hub.createPackage({
      card,
      creator: "test",
    });

    hub.createWorkflow(pkg.id, "Workflow 1", { prompt: "prompt 1" });
    hub.createWorkflow(pkg.id, "Workflow 2", { prompt: "prompt 2" });

    const workflows = hub.getWorkflows(pkg.id);
    expect(workflows).toHaveLength(2);
    expect(workflows.map((w) => w.name)).toEqual(["Workflow 1", "Workflow 2"]);
  });

  it("should add image assets to a package", () => {
    const hub = new AIHub();

    const card = makeTestCard("Luna");
    const pkg = hub.createPackage({
      card,
      creator: "test",
    });

    const image = {
      id: "img-1",
      url: "https://example.com/img.webp",
      title: "Generated Portrait",
      description: "AI generated",
      prompt: "portrait",
      model: "sd_xl_base_1.0",
    };

    const result = hub.addImageAsset(pkg.id, image);
    expect(result).not.toBeNull();
    expect(result?.media.images).toBeDefined();
    expect(result?.media.images).toHaveLength(1);
  });

  it("should get all images across packages", () => {
    const hub = new AIHub();
    const card = makeTestCard("Luna");
    const pkg = hub.createPackage({
      card,
      creator: "test",
    });

    hub.addImageAsset(pkg.id, {
      id: "img-1",
      url: "https://example.com/1.webp",
      title: "Image 1",
      description: "Test",
      prompt: "prompt",
      model: "test",
    });

    expect(hub.getAllImages().length).toBeGreaterThanOrEqual(1);
  });

  it("should get package images including attached media images", () => {
    const hub = new AIHub();
    const card = makeTestCard("Luna");
    const pkg = hub.createPackage({
      card,
      creator: "test",
    });

    hub.addImageAsset(pkg.id, {
      id: "img-1",
      url: "https://example.com/1.webp",
      title: "Image 1",
      description: "Test",
      prompt: "prompt",
      model: "test",
    });

    const images = hub.getPackageImages(pkg.id);
    expect(images).toHaveLength(1);
    expect(images[0].id).toBe("img-1");
  });

  it("should get gallery items merging gallery + images", () => {
    const hub = new AIHub();
    const card = makeTestCard("Luna");
    const pkg = hub.createPackage({
      card,
      creator: "test",
      media: {
        avatarUrl: "https://example.com/avatar.webp",
        gallery: ["https://example.com/1.webp", "https://example.com/2.webp"],
      },
    });

    hub.addImageAsset(pkg.id, {
      id: "img-gen-1",
      url: "https://example.com/gen.webp",
      title: "Generated",
      description: "AI generated",
      prompt: "prompt",
      model: "sd_xl",
    });

    const items = hub.getGalleryItems(pkg.id);
    expect(items).toHaveLength(3);
    const imageItems = items.filter((i) => i.type === "image");
    expect(imageItems).toHaveLength(3);
  });

  it("should get trending scores (empty for local packages)", () => {
    const hub = new AIHub();
    const card = makeTestCard("Luna");
    hub.createPackage({ card, creator: "test" });

    const scores = hub.getTrendingScores();
    expect(scores).toBeInstanceOf(Map);
    expect(scores.size).toBe(0);
  });
});

describe("ComfyUIClient", () => {
  it("should expose default workflow structure", () => {
    expect(DEFAULT_WORKFLOW["1"].class_type).toBe("CheckpointLoaderSimple");
    expect(DEFAULT_WORKFLOW["4"].inputs.width).toBe(512);
    expect(DEFAULT_WORKFLOW["4"].inputs.height).toBe(768);
  });

  it("should set and get URL", () => {
    const client = new ComfyUIClient("http://localhost:8188");
    expect(client.getURL()).toBe("http://localhost:8188");
  });

  it("should handle disconnected ComfyUI", async () => {
    const client = new ComfyUIClient("http://nonexistent-host:9999");
    const status = await client.getStatus();
    expect(status.online).toBe(false);
  });

  it("should create workflow from prompt with defaults", () => {
    const client = new ComfyUIClient();

    const workflow = client.createWorkflowFromPrompt("wf-1", "Test", {
      prompt: "a beautiful landscape",
    });

    expect(workflow.id).toBe("wf-1");
    expect(workflow.name).toBe("Test");
    expect(workflow.lastPrompt).toBe("a beautiful landscape");
    expect(workflow.width).toBe(512);
    expect(workflow.height).toBe(768);
    expect(workflow.steps).toBe(20);
    expect(workflow.cfg).toBe(7);
    expect(workflow.seed).toBeDefined();
  });

  it("should create workflow with custom params", () => {
    const client = new ComfyUIClient();

    const workflow = client.createWorkflowFromPrompt("wf-1", "Test", {
      prompt: "test",
      negativePrompt: "ugly",
      model: "sd_xl_base_1.0",
      width: 1024,
      height: 512,
      steps: 30,
      cfg: 8,
      sampler: "dpmpp_2m",
      seed: 12345,
    });

    expect(workflow.lastNegativePrompt).toBe("ugly");
    expect(workflow.baseModel).toBe("sd_xl_base_1.0");
    expect(workflow.width).toBe(1024);
    expect(workflow.height).toBe(512);
    expect(workflow.steps).toBe(30);
    expect(workflow.cfg).toBe(8);
    expect(workflow.sampler).toBe("dpmpp_2m");
    expect(workflow.seed).toBe(12345);
  });

  it("should submit workflow and fail gracefully when ComfyUI is offline", async () => {
    const client = new ComfyUIClient("http://nonexistent-host:9999");
    const workflow = client.createWorkflowFromPrompt("wf-1", "Test", {
      prompt: "test",
    });

    const job = await client.submitWorkflow(workflow);
    expect(job.status).toBe("failed");
    expect(job.error).toBeDefined();
  });

  it("should handle delete on non-running job", async () => {
    const client = new ComfyUIClient();
    await expect(client.deleteJob("nonexistent")).resolves.toBeUndefined();
  });
});
