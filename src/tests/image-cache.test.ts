import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { cacheUploadedImage, deleteCachedUpload, getCachedUploads } from "@/lib/image-cache";

function uniqueId(prefix: string) {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

describe("uploaded image cache", () => {
	it("persists an uploaded image blob with metadata for reload restore", async () => {
	const id = uniqueId("upload-restore");
	const blob = new Blob(["fake-image-bytes"], { type: "image/png" });
	await cacheUploadedImage({ id, title: "portrait", blob, generatedAt: 42 });
	const image = (await getCachedUploads()).find((item) => item.placeholderUrl === `upload:${id}`);
		expect(image).toBeDefined();
		expect(image?.title).toBe("portrait");
		expect(image?.blob.type).toBe("image/png");
		expect(await image?.blob.text()).toBe("fake-image-bytes");
	});

	it("deletes a previously persisted upload", async () => {
	const id = uniqueId("upload-delete");
	await cacheUploadedImage({ id, title: "delete me", blob: new Blob(["x"], { type: "image/jpeg" }), generatedAt: 43 });
	await deleteCachedUpload(id);
		expect((await getCachedUploads()).some((item) => item.placeholderUrl === `upload:${id}`)).toBe(false);
	});
});
