import { AIHub } from "@/lib/ai-hub";
import { CharacterCardParser } from "@/lib/character-card";
import type { TrysteroP2PClient } from "@/lib/trystero-client";
import type { CharacterCard } from "@/types/character";
import { beforeEach, describe, expect, it } from "vitest";

describe("AIHub", () => {
  let hub: AIHub;

  const makeTestCard = (name = "TestAI") =>
    CharacterCardParser.createDefaultCard(name);

  beforeEach(() => {
    hub = new AIHub();
  });

  it("initializes empty", () => {
    expect(hub.getAllPackages()).toEqual([]);
    expect(hub.getTrendingPackages()).toEqual([]);
  });

  it("creates a package from character card", () => {
    const card = makeTestCard("Luna");
    const pkg = hub.createPackage({
      card,
      description: "Test companion",
      creator: "testuser",
      baseModel: "Qwen3-0.6B",
      tags: ["romantic", "playful"],
      category: "realistic",
    });

    expect(pkg.id).toBeTruthy();
    expect(pkg.spec).toBe("ai-package-v1");
    expect(pkg.metadata.name).toBe("Luna");
    expect(pkg.metadata.creator).toBe("testuser");
    expect(pkg.metadata.baseModel).toBe("Qwen3-0.6B");
    expect(pkg.metadata.tags).toEqual(["romantic", "playful"]);
    expect(pkg.metadata.category).toBe("realistic");
    expect(pkg.metadata.createdAt).toBeLessThanOrEqual(pkg.metadata.updatedAt);
    expect(pkg.metadata.downloadCount).toBe(0);
    expect(pkg.metadata.forks).toBe(0);
    expect(pkg.metadata.isPublic).toBe(false);
  });

  it("throws on card without name", () => {
    const card = {
      spec: "chara_card_v2" as const,
      data: { name: "" },
    } as unknown as CharacterCard;
    expect(() => hub.createPackage({ card, creator: "test" })).toThrow(
      "Character card must have a name",
    );
  });

  it("clones a package without attribution", () => {
    const card = makeTestCard("Original");
    const original = hub.createPackage({
      card,
      creator: "originalCreator",
    });

    const clone = hub.clonePackage(original, { creator: "cloner" });

    expect(clone.id).not.toBe(original.id);
    expect(clone.metadata.creator).toBe("cloner");
    expect(clone.metadata.name).toBe("Original");
    expect(clone.metadata.downloadCount).toBe(0);
    expect(clone.metadata.likeCount).toBe(0);
    expect(clone.forkedFrom).toBeUndefined();
    expect(original.metadata.forks).toBe(0);
  });

  it("forks a package with attribution", () => {
    const card = makeTestCard("RemixBase");
    const original = hub.createPackage({
      card,
      creator: "originalCreator",
    });

    const fork = hub.forkPackage(original, "remixer", {
      name: "MyRemix",
      systemPrompt: "You are a remixed AI.",
    });

    expect(fork.id).not.toBe(original.id);
    expect(fork.metadata.name).toBe("MyRemix");
    expect(fork.metadata.creator).toBe("remixer");
    expect(fork.metadata.version).toBe("1.0.0-fork");
    expect(fork.forkedFrom).toBeDefined();
    expect(fork.forkedFrom?.id).toBe(original.id);
    expect(fork.forkedFrom?.name).toBe("RemixBase");
    expect(fork.config.systemPrompt).toBe("You are a remixed AI.");

    expect(original.metadata.forks).toBe(1);
  });

  it("forks with custom tags merged", () => {
    const card = makeTestCard("TaggedAI");
    const original = hub.createPackage({
      card,
      creator: "orig",
      tags: ["romantic"],
    });

    const fork = hub.forkPackage(original, "me", {
      tags: ["tsundere", "spicy"],
    });

    expect(fork.metadata.tags).toContain("romantic");
    expect(fork.metadata.tags).toContain("tsundere");
    expect(fork.metadata.tags).toContain("spicy");
  });

  it("exports and imports a package", () => {
    const card = makeTestCard("ExportTest");
    const original = hub.createPackage({
      card,
      creator: "exporter",
    });

    const exported = hub.exportPackage(original);
    expect(exported.exportedBy).toBe("exporter");
    expect(exported.exportedAt).toBeTruthy();

    const imported = hub.importPackage(exported);
    expect(imported.id).not.toBe(original.id);
    expect(imported.metadata.name).toBe("ExportTest");
    expect(imported.metadata.creator).toBe("exporter");
    expect(hub.getPackage(imported.id)).toBeDefined();
  });

  it("converts package to profile", () => {
    const card = makeTestCard("ProfileTest");
    const pkg = hub.createPackage({
      card,
      creator: "test",
    });

    const profile = hub.packageToProfile(pkg);
    expect(profile.name).toBe("ProfileTest");
    expect(profile.stage).toBe(2);
    expect(Array.isArray(profile.personality)).toBe(true);
    expect(Array.isArray(profile.hobbies)).toBe(true);
  });

  it("returns stats", () => {
    const card = makeTestCard("StatTest");
    hub.createPackage({ card, creator: "test" });

    const stats = hub.getStats();
    expect(stats.totalPackages).toBe(1);
    expect(stats.totalDownloads).toBe(0);
    expect(stats.cachedModels).toBe(0);
  });

  it("shares package when client is set", async () => {
    const mockClient = {
      getNetworkState: () => ({
        peerCount: 2,
        peers: [{ id: "peer1", joinedAt: 0 }],
      }),
      onColibriGateway: () => () => {},
      room: {
        makeAction: () => ({ send: () => {} }),
      },
    } as unknown as TrysteroP2PClient;

    hub.setClient(mockClient);

    const card = makeTestCard("ShareTest");
    const pkg = hub.createPackage({ card, creator: "sharer" });

    const result = await hub.sharePackage(pkg);

    expect(result.success).toBe(true);
    expect(result.bytesSent).toBeGreaterThan(0);
    expect(pkg.metadata.isPublic).toBe(true);
    expect(pkg.metadata.publishedAt).toBeTruthy();
  });

  it("does not share when no P2P peers are connected", async () => {
    const noPeerClient = {
      getNetworkState: () => ({ peerCount: 0, peers: [] }),
      onColibriGateway: () => () => {},
      room: { makeAction: () => ({ send: () => {} }) },
    } as unknown as TrysteroP2PClient;
    hub.setClient(noPeerClient);
    const pkg = hub.createPackage({
      card: makeTestCard("NoPeers"),
      creator: "test",
    });
    const result = await hub.sharePackage(pkg);
    expect(result.success).toBe(false);
    expect(result.error).toBe("No P2P peers are currently connected");
    expect(pkg.metadata.isPublic).toBe(false);
  });

  it("fails to share without client", async () => {
    const card = makeTestCard("NoClient");
    const pkg = hub.createPackage({ card, creator: "test" });

    const result = await hub.sharePackage(pkg);
    expect(result.success).toBe(false);
    expect(result.error).toBe("No P2P connection");
  });

  it("receives package via P2P message", () => {
    let messageHandler:
      ((msg: unknown, ctx: { peerId: string }) => void) | undefined;
    const room = {
      makeAction: (_id: string) => {
        const action = {
          onMessage: null as
            ((msg: unknown, ctx: { peerId: string }) => void) | null,
        };
        Object.defineProperty(action, "onMessage", {
          get: () => messageHandler,
          set: (handler: (msg: unknown, ctx: { peerId: string }) => void) => {
            messageHandler = handler;
          },
        });
        return action;
      },
    };
    const mockClient = {
      onColibriGateway: () => () => {},
      room,
    } as unknown as TrysteroP2PClient;

    hub.setClient(mockClient);
    const pkg = hub.createPackage({
      card: makeTestCard("IncomingAI"),
      creator: "peer1",
    });
    const incoming = { ...pkg, id: `${pkg.id}-peer-copy` };
    messageHandler?.(incoming, { peerId: "peer-xyz" });

    const received = hub.getPackage(incoming.id);
    expect(received).toBeDefined();
    expect(received?.metadata.creator).toBe("peer1");
    expect(
      hub.getTrendingPackages().find((item) => item.id === incoming.id)
        ?.peersWithModel,
    ).toBe(1);
  });

  it("uses default MCP tools when none provided", () => {
    const card = makeTestCard("ToolTest");
    const pkg = hub.createPackage({ card, creator: "test" });

    expect(pkg.tools.length).toBeGreaterThan(0);
    expect(pkg.tools[0].name).toBe("Memory");
  });

  it("returns empty for unknown package ID", () => {
    expect(hub.getPackage("nonexistent-id")).toBeUndefined();
  });

  // Regression: isPlaceholderUrl detects the SVG markers used by the
  // 100 preset images under /images/pending/.
  it("isPlaceholderUrl returns true for /images/pending/ URLs", () => {
    expect(AIHub.isPlaceholderUrl("/images/pending/luna-01.svg")).toBe(true);
    expect(AIHub.isPlaceholderUrl("/images/luna-featured.svg")).toBe(true);
    expect(AIHub.isPlaceholderUrl("/images/luna-banner.svg")).toBe(true);
    expect(AIHub.isPlaceholderUrl("https://example.com/photo.png")).toBe(false);
    expect(AIHub.isPlaceholderUrl("blob:abc")).toBe(false);
  });

  it("generateReplacementForPlaceholder returns error when package missing", async () => {
    const result = await hub.generateReplacementForPlaceholder(
      "does-not-exist",
      "/images/pending/luna-01.svg",
      { prompt: "test" },
    );
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toMatch(/Package not found|ComfyUI/);
    }
  });

  it("generateReplacementForPlaceholder returns error when ComfyUI offline", async () => {
    const card = makeTestCard("Offline");
    const pkg = hub.createPackage({ card, creator: "o" });
    const result = await hub.generateReplacementForPlaceholder(
      pkg.id,
      "/images/pending/luna-01.svg",
      { prompt: "a portrait" },
    );
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toMatch(/ComfyUI|client|not/);
    }
  });

  // Regression: generateReplacementForPlaceholderCached should be a thin
  // wrapper that tries the cache before delegating to the live version.
  // We can't exercise the IndexedDB cache inside happy-dom, but we can
  // assert the API surface and confirm a no-cache run still hits the
  // ComfyUI error path.
  it("generateReplacementForPlaceholderCached exposes the same shape", async () => {
    expect(typeof hub.generateReplacementForPlaceholderCached).toBe(
      "function",
    );
    const card = makeTestCard("Cached");
    const pkg = hub.createPackage({ card, creator: "c" });
    const result = await hub.generateReplacementForPlaceholderCached(
      pkg.id,
      "/images/pending/luna-01.svg",
      { prompt: "portrait" },
    );
    // Without ComfyUI running (and without IndexedDB) we expect an error
    // describing the missing ComfyUI client, not a successful image.
    expect("error" in result).toBe(true);
  });
});
