/**
 * i18n — minimal, type-safe, lazy-loaded translation system.
 *
 * Why no library: react-i18next ships a non-trivial runtime that vite
 * inlines into the main bundle as a bare module specifier (we just hit
 * that bug with @xenova/transformers). This module is small (~2KB),
 * fully typed, and lets us split each language into its own chunk via
 * dynamic import().
 *
 * Usage:
 *   const { t, locale, setLocale } = useI18n();
 *   <h1>{t("home.title")}</h1>
 *   <button>{t("home.greeting", { name: "World" })}</button>
 *   <p>{t("cart.items", { count: 3 })}</p>     // pluralized per locale
 */
import { useCallback, useEffect, useState } from "react";

export type Locale = "en" | "ko" | "ja" | "zh" | "my" | "vi";
export const SUPPORTED_LOCALES: ReadonlyArray<Locale> = ["en", "ko", "ja", "zh", "my", "vi"];
export const DEFAULT_LOCALE: Locale = "en";

const STORAGE_KEY = "privsei.locale";
const LOCALE_EVENT = "privsei:locale-change";

export interface TranslationTree {
	readonly [key: string]: string | TranslationTree;
}

/** Resolve a flat dotted key ("home.title") against a nested tree. */
export function lookup(tree: TranslationTree | null | undefined, key: string): string | null {
	if (!tree) return null;
	const parts = key.split(".");
	let cursor: string | TranslationTree | undefined = tree;
	for (const part of parts) {
		if (typeof cursor !== "object" || cursor === null) return null;
		cursor = (cursor as TranslationTree)[part];
		if (cursor === undefined) return null;
	}
	return typeof cursor === "string" ? cursor : null;
}

/** Replace {name} / {count} style placeholders. */
export function interpolate(template: string, vars: Record<string, string | number>): string {
	return template.replace(/\{(\w+)\}/g, (_, k: string) => {
		const v = vars[k];
		return v === undefined ? `{${k}}` : String(v);
	});
}

/** Tiny English-only pluralization; ko/ja/zh have a single form. */
export function plural(trees: TranslationTree | null | undefined, key: string, count: number): string | null {
	if (!trees) return null;
	const parts = key.split(".");
	// Walk into the tree to the parent, then look at the final segment as a
	// plural subtree { one, other }.
	let cursor: TranslationTree | string | undefined = trees;
	for (let i = 0; i < parts.length - 1; i++) {
		if (typeof cursor !== "object" || cursor === null) return null;
		cursor = cursor[parts[i]];
	}
	const last = parts[parts.length - 1];
	if (typeof cursor !== "object" || cursor === null) return null;
	const subtree = (cursor as TranslationTree)[last];
	if (!subtree || typeof subtree !== "object") {
		return lookup(trees, key);
	}
	const form = count === 1 ? "one" : "other";
	const value = (subtree as TranslationTree)[form] ?? (subtree as TranslationTree).other;
	return typeof value === "string" ? value : null;
}

/** Detect the user's preferred locale from the browser, falling back to en. */
function detectLocale(): Locale {
	if (typeof window === "undefined") return DEFAULT_LOCALE;
	try {
		const stored = window.localStorage.getItem(STORAGE_KEY);
		if (stored && SUPPORTED_LOCALES.includes(stored as Locale)) {
			return stored as Locale;
		}
	} catch {
		// localStorage may be disabled (private mode).
	}
	const langs = navigator.languages ?? [navigator.language];
	for (const raw of langs) {
		const code = raw.toLowerCase().slice(0, 2);
		if (SUPPORTED_LOCALES.includes(code as Locale)) return code as Locale;
	}
	return DEFAULT_LOCALE;
}

const cache: Partial<Record<Locale, TranslationTree>> = {};
const inflight: Partial<Record<Locale, Promise<TranslationTree>>> = {};

async function loadLocale(locale: Locale): Promise<TranslationTree> {
	if (cache[locale]) return cache[locale];
	if (inflight[locale]) return inflight[locale] as Promise<TranslationTree>;
	const p = import(`./locales/${locale}.json`).then(
		(mod) => {
			const data = (mod.default ?? mod) as TranslationTree;
			cache[locale] = data;
			return data;
		},
		() => {
			// Fallback to English if the chunk failed to load.
			return cache[DEFAULT_LOCALE] ?? {};
		},
	);
	inflight[locale] = p;
	return p;
}

/** Preload the user's locale + English fallback. */
export async function preloadI18n(): Promise<void> {
	await Promise.all([loadLocale(detectLocale()), loadLocale(DEFAULT_LOCALE)]);
}

// ---------- React integration ---------------------------------------------

export interface I18nApi {
	t: (key: string, vars?: Record<string, string | number>) => string;
	tPlural: (key: string, count: number, vars?: Record<string, string | number>) => string;
	locale: Locale;
	setLocale: (next: Locale) => void;
	ready: boolean;
}

export function useI18n(): I18nApi {
	const [locale, setLocaleState] = useState<Locale>(detectLocale);
	const [ready, setReady] = useState(() => cache[locale] !== undefined);
	const [trees, setTrees] = useState<{ base: TranslationTree; fallback: TranslationTree }>(() => {
		const initial = cache[locale] ?? cache[DEFAULT_LOCALE] ?? {};
		const fallback = cache[DEFAULT_LOCALE] ?? initial;
		return { base: initial, fallback };
	});

	// Load the active tree whenever locale changes.
	useEffect(() => {
		let cancelled = false;
		setReady(false);
		(async () => {
			const base = await loadLocale(locale);
			const fallback = await loadLocale(DEFAULT_LOCALE);
			if (cancelled) return;
			setTrees({ base, fallback });
			setReady(true);
		})();
		return () => {
			cancelled = true;
		};
	}, [locale]);

	useEffect(() => {
		const onLocaleChange = (event: Event) => {
			const next = (event as CustomEvent<Locale>).detail;
			if (SUPPORTED_LOCALES.includes(next)) setLocaleState(next);
		};
		window.addEventListener(LOCALE_EVENT, onLocaleChange);
		return () => window.removeEventListener(LOCALE_EVENT, onLocaleChange);
	}, []);

	const setLocale = useCallback((next: Locale) => {
		if (!SUPPORTED_LOCALES.includes(next)) return;
		try {
			window.localStorage.setItem(STORAGE_KEY, next);
		} catch {
			// ignore
		}
		setLocaleState(next);
		window.dispatchEvent(new CustomEvent(LOCALE_EVENT, { detail: next }));
	}, []);

	const t = useCallback(
		(key: string, vars?: Record<string, string | number>) => {
			const raw = lookup(trees.base, key) ?? lookup(trees.fallback, key) ?? key;
			return vars ? interpolate(raw, vars) : raw;
		},
		[trees],
	);

	const tPlural = useCallback(
		(key: string, count: number, vars?: Record<string, string | number>) => {
			const raw =
				plural(trees.base, key, count) ??
				plural(trees.fallback, key, count) ??
				key;
			return vars ? interpolate(raw, { ...vars, count }) : raw;
		},
		[trees],
	);

	return { t, tPlural, locale, setLocale, ready };
}
