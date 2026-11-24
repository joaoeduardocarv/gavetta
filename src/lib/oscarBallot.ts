export type OscarPick = {
  kind: "film" | "person" | "skipped";
  tmdb_id: number;
  title: string;
  image: string | null;
  nominee_id?: string | null;
  sub?: string | null;
};

export const SKIPPED_PICK: OscarPick = { kind: "skipped", tmdb_id: 0, title: "Não vi", image: null };

export const isSkipped = (p?: OscarPick | null) => p?.kind === "skipped";

export function isOptionSelected(pick: OscarPick | undefined, opt: Pick<OscarPick, "kind" | "tmdb_id" | "nominee_id" | "title" | "sub">) {
  if (!pick || isSkipped(pick)) return false;
  if (pick.nominee_id && opt.nominee_id) return pick.nominee_id === opt.nominee_id;
  if (pick.kind !== opt.kind || pick.tmdb_id !== opt.tmdb_id) return false;
  if (opt.sub && pick.sub) return pick.sub === opt.sub;
  return pick.title === opt.title;
}

/** Categories that go on the share image: only those with a real pick (skipped/"Não vi" are left out). */
export function shareableCategories<C extends { id: string }>(cats: C[], picks: Record<string, OscarPick>) {
  return cats.filter((c) => picks[c.id] && !isSkipped(picks[c.id])).map((c) => ({ category: c, pick: picks[c.id] }));
}
