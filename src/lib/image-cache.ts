/**
 * IndexedDB-backed cache for generated companion images.
 *
 * Why a separate module: image URLs returned by ComfyUI are usually
 * blob:/http://127.0.0.1:8188/... and disappear on reload. We persist the
 * raw image bytes (Blob) plus metadata (prompt, model, generatedAt) so that
 * a returning user sees their generated portraits immediately, without
 * having to re-run ComfyUI.
 *
 * Key format: `${pkgId}:${placeholderUrl}` so different companions can share
 * the same placeholder while still being cacheable.
 */

const DB_NAME = "privsei-image-cache";
const STORE = "images";
const VERSION = 1;

export interface CachedImage {
	pkgId: string;
	placeholderUrl: string;
	url: string;
	title: string;
	prompt: string;
	model: string;
	generatedAt: number;
	blob: Blob;
}

let _dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
	if (_dbPromise) return _dbPromise;
	_dbPromise = new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE)) {
				db.createObjectStore(STORE, { keyPath: "key" });
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
	return _dbPromise;
}

function key(pkgId: string, placeholderUrl: string): string {
	return `${pkgId}:${placeholderUrl}`;
}

async function tx<T>(
	mode: IDBTransactionMode,
	fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
	const db = await openDb();
	return new Promise<T>((resolve, reject) => {
		const transaction = db.transaction(STORE, mode);
		const store = transaction.objectStore(STORE);
		const req = fn(store);
		let result: T;
		req.onsuccess = () => { result = req.result; };
		req.onerror = () => reject(req.error);
		transaction.oncomplete = () => resolve(result);
		transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
		transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
	});
}

/**
 * Store a generated image keyed by (pkgId, placeholderUrl).
 */
export async function cacheImage(
	pkgId: string,
	placeholderUrl: string,
	payload: Omit<CachedImage, "pkgId" | "placeholderUrl">,
): Promise<void> {
	await tx("readwrite", (store) =>
		store.put({
			key: key(pkgId, placeholderUrl),
			pkgId,
			placeholderUrl,
			...payload,
		}),
	);
}

/** Look up a cached image; returns null if no cache entry exists. */
export async function getCachedImage(
	pkgId: string,
	placeholderUrl: string,
): Promise<CachedImage | null> {
	const result = await tx<CachedImage | undefined>("readonly", (store) =>
		store.get(key(pkgId, placeholderUrl)),
	);
	if (!result) return null;
	const { key: _ignored, ...rest } = result as CachedImage & { key: string };
	return rest;
}

/** Bulk lookup — useful when booting the hub and preloading cached images. */
export async function getAllCachedImages(): Promise<CachedImage[]> {
	const all = await tx<CachedImage[]>("readonly", (store) => store.getAll());
	return all.map((entry) => {
		const { key: _k, ...rest } = entry as CachedImage & { key: string };
		return rest;
	});
}

/** Drop a single cache entry. */
export async function evictCachedImage(
	pkgId: string,
	placeholderUrl: string,
): Promise<void> {
	await tx("readwrite", (store) => store.delete(key(pkgId, placeholderUrl)));
}


/** Stable cache namespace for files uploaded from /collection. */
export function uploadedImageKey(id: string): string {
	return `upload:${id}`;
}

/** Persist a user-uploaded image blob across reloads. */
export async function cacheUploadedImage(input: {
	id: string;
	title: string;
	blob: Blob;
	generatedAt: number;
}): Promise<void> {
	const placeholderUrl = uploadedImageKey(input.id);
	await cacheImage("__uploads__", placeholderUrl, {
		url: placeholderUrl,
		title: input.title,
		prompt: "",
		model: "uploaded",
		generatedAt: input.generatedAt,
		blob: input.blob,
	});
}

/** Return all upload records in creation order. */
export async function getCachedUploads(): Promise<CachedImage[]> {
	const all = await getAllCachedImages();
	return all
		.filter((image) => image.pkgId === "__uploads__" && image.placeholderUrl.startsWith("upload:"))
		.sort((a, b) => a.generatedAt - b.generatedAt);
}

/** Remove an uploaded image from persistent storage. */
export async function deleteCachedUpload(id: string): Promise<void> {
	await evictCachedImage("__uploads__", uploadedImageKey(id));
}
