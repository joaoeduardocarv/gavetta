export type OscarPick = { kind: "film" | "person" | "skipped"; tmdb_id: number; title: string; image: string | null };

export const SKIPPED_PICK: OscarPick = { kind: "skipped", tmdb_id: 0, title: "Não vi", image: null };

export const isSkipped = (p?: OscarPick | null) => p?.kind === "skipped";

/** Categories that go on the share image: only those with a real pick (skipped/"Não vi" are left out). */
export function shareableCategories<C extends { id: string }>(cats: C[], picks: Record<string, OscarPick>) {
  return cats.filter((c) => picks[c.id] && !isSkipped(picks[c.id])).map((c) => ({ category: c, pick: picks[c.id] }));
}
