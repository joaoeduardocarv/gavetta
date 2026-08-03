import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { shouldNotify } from "./notificationFilters.ts";

const watched = new Set(["watched"]);
const watchlist = new Set(["watchlist"]);
const watchedAndCustom = new Set(["watched", "custom-123"]);

Deno.test("suppresses availability notifications for titles only in Assistidos (default off)", () => {
  for (const type of ["streaming_change", "rental_arrival", "purchase_arrival"]) {
    assertEquals(shouldNotify({ watched_availability: false }, type, watched), false);
    // missing preference row => still suppressed by default
    assertEquals(shouldNotify(undefined, type, watched), false);
    // preference column absent => treated as disabled
    assertEquals(shouldNotify({ streaming_changes: true }, type, watched), false);
  }
});

Deno.test("sends availability notifications for Assistidos when watched_availability is enabled", () => {
  for (const type of ["streaming_change", "rental_arrival", "purchase_arrival"]) {
    assertEquals(shouldNotify({ watched_availability: true }, type, watched), true);
  }
});

Deno.test("respects the specific availability preference even when watched_availability is on", () => {
  assertEquals(
    shouldNotify({ watched_availability: true, streaming_changes: false }, "streaming_change", watched),
    false,
  );
  assertEquals(
    shouldNotify({ watched_availability: true, rental_arrival: false }, "rental_arrival", watched),
    false,
  );
});

Deno.test("does not suppress when the title is also in another drawer", () => {
  assertEquals(shouldNotify({ watched_availability: false }, "streaming_change", watchedAndCustom), true);
  assertEquals(shouldNotify({ watched_availability: false }, "rental_arrival", watchlist), true);
  assertEquals(shouldNotify(undefined, "purchase_arrival", watchlist), true);
});

Deno.test("non-availability notifications are unaffected by the Assistidos rule", () => {
  for (const type of ["new_season", "new_episodes", "upcoming_content"]) {
    assertEquals(shouldNotify({ watched_availability: false }, type, watched), true);
  }
  assertEquals(shouldNotify({ new_episodes: false }, "new_episodes", watched), false);
});

Deno.test("missing drawer info falls back to normal preference handling", () => {
  assertEquals(shouldNotify({ watched_availability: false }, "streaming_change", undefined), true);
  assertEquals(shouldNotify({ watched_availability: false }, "streaming_change", new Set()), true);
});
