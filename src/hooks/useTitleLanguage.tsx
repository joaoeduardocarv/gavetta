import { useSyncExternalStore, useCallback } from "react";

type TitleLang = "pt" | "original";

const STORAGE_KEY = "gavetta:titleLang";

function readInitial(): TitleLang {
  if (typeof window === "undefined") return "pt";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "original" ? "original" : "pt";
  } catch {
    return "pt";
  }
}

let currentLang: TitleLang = readInitial();
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): TitleLang {
  return currentLang;
}

function setLang(next: TitleLang) {
  if (next === currentLang) return;
  currentLang = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

interface TitleSource {
  title?: string | null;
  originalTitle?: string | null;
}

export function resolveTitleFor(content: TitleSource, lang: TitleLang): string {
  const title = (content.title ?? "").toString();
  const original = (content.originalTitle ?? "").toString();
  if (lang === "original" && original && original !== title) {
    return original;
  }
  return title || original || "Sem título";
}

export function hasAlternateTitle(content: TitleSource): boolean {
  const title = (content.title ?? "").toString();
  const original = (content.originalTitle ?? "").toString();
  return Boolean(original) && original !== title;
}

export function useTitleLanguage() {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const toggle = useCallback(() => {
    setLang(currentLang === "pt" ? "original" : "pt");
  }, []);

  const resolveTitle = useCallback(
    (content: TitleSource) => resolveTitleFor(content, lang),
    [lang]
  );

  return { lang, toggle, resolveTitle, hasAlternateTitle };
}
