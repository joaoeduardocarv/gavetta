// Pure logic for deciding whether a user should receive a notification.
// Extracted so it can be unit-tested without hitting Supabase/TMDB.

export type Prefs = Record<string, boolean> | undefined;

/** Availability-related notification types ("Disponível em") */
export const AVAILABILITY_TYPES = new Set([
  'streaming_change',
  'rental_arrival',
  'purchase_arrival',
]);

export const PREF_COLUMN_BY_TYPE: Record<string, string> = {
  streaming_change: 'streaming_changes',
  new_season: 'new_seasons',
  new_episodes: 'new_episodes',
  upcoming_content: 'upcoming_content',
  rental_arrival: 'rental_arrival',
  purchase_arrival: 'purchase_arrival',
};

/**
 * Decide if the user wants a notification of `type` for a production that lives
 * in `drawerIds`. Availability notifications are suppressed when the title is
 * ONLY in the "watched" (Assistidos) drawer, unless `watched_availability` is on.
 */
export function shouldNotify(
  prefs: Prefs,
  type: string,
  drawerIds?: Set<string>,
): boolean {
  if (AVAILABILITY_TYPES.has(type) && drawerIds && drawerIds.size > 0) {
    const onlyWatched = [...drawerIds].every((d) => d === 'watched');
    if (onlyWatched && prefs?.watched_availability !== true) return false;
  }

  if (!prefs) return true; // default: all enabled
  const col = PREF_COLUMN_BY_TYPE[type];
  return col ? prefs[col] !== false : true;
}
