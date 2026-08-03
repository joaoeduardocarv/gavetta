import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { shouldNotify } from "./notificationFilters.ts";
import { brToday, daysUntil } from "./dateHelpers.ts";

// ───────── release_date ausente / inválido ─────────

Deno.test("daysUntil returns NaN for missing or invalid release dates", () => {
  const now = Date.parse("2026-08-03T12:00:00Z");
  for (const value of [null, undefined, "", "TBA", "??", "not-a-date"]) {
    assert(Number.isNaN(daysUntil(value as string | null, now)), `expected NaN for ${String(value)}`);
  }
});

Deno.test("NaN day counts never match the notification windows", () => {
  const now = Date.parse("2026-08-03T12:00:00Z");
  const d = daysUntil(null, now);
  assertEquals(d === 0, false);
  assertEquals(d === 2, false);
  assertEquals(d === 7, false);
  assertEquals(d <= 7 && d >= 0, false);
});

Deno.test("suppression rule is independent of release_date being absent", () => {
  // Um título em Assistidos sem data de estreia continua sem aviso de disponibilidade
  assertEquals(shouldNotify(undefined, "streaming_change", new Set(["watched"])), false);
  assertEquals(Number.isNaN(daysUntil(undefined)), true);
});

// ───────── timezone ─────────

Deno.test("brToday uses UTC-3, not UTC", () => {
  // 02:00 UTC de 04/08 ainda é 03/08 no Brasil
  assertEquals(brToday(Date.parse("2026-08-04T02:00:00Z")), "2026-08-03");
  // 03:00 UTC de 04/08 já virou o dia no Brasil
  assertEquals(brToday(Date.parse("2026-08-04T03:00:00Z")), "2026-08-04");
  // Virada de mês
  assertEquals(brToday(Date.parse("2026-09-01T01:00:00Z")), "2026-08-31");
});

Deno.test("daysUntil is stable across the UTC day boundary", () => {
  const beforeMidnightBr = Date.parse("2026-08-04T02:59:00Z"); // 03/08 23:59 BR
  const afterMidnightBr = Date.parse("2026-08-04T03:01:00Z"); // 04/08 00:01 BR

  assertEquals(daysUntil("2026-08-05", beforeMidnightBr), 2);
  assertEquals(daysUntil("2026-08-05", afterMidnightBr), 1);
  assertEquals(daysUntil("2026-08-04", beforeMidnightBr), 1);
  assertEquals(daysUntil("2026-08-04", afterMidnightBr), 0);
  // datas passadas ficam negativas
  assertEquals(daysUntil("2026-08-01", afterMidnightBr), -3);
});

Deno.test("daysUntil accepts full ISO timestamps and ignores their time part", () => {
  const now = Date.parse("2026-08-03T12:00:00Z");
  assertEquals(daysUntil("2026-08-10T23:30:00.000Z", now), 7);
  assertEquals(daysUntil("2026-08-03T00:00:00Z", now), 0);
});

Deno.test("suppression rule does not depend on the current time", () => {
  const drawers = new Set(["watched"]);
  for (const iso of ["2026-01-01T00:00:00Z", "2026-08-04T02:59:00Z", "2026-12-31T23:59:00Z"]) {
    // regra é puramente baseada em gavetas + preferências
    assertEquals(shouldNotify({ watched_availability: false }, "rental_arrival", drawers), false);
    assert(!Number.isNaN(Date.parse(iso)));
  }
});

// ───────── conteúdo duplicado entre gavetas ─────────

Deno.test("duplicate assignments in the same watched drawer stay suppressed", () => {
  // mesmo título adicionado duas vezes em 'watched' -> Set colapsa para um item
  const drawers = new Set<string>();
  drawers.add("watched");
  drawers.add("watched");
  assertEquals(drawers.size, 1);
  assertEquals(shouldNotify({ watched_availability: false }, "streaming_change", drawers), false);
});

Deno.test("title duplicated across watched + another drawer is NOT suppressed", () => {
  const combos = [
    ["watched", "watchlist"],
    ["watched", "watching"],
    ["watched", "custom-abc"],
    ["watchlist", "watched"],
  ];
  for (const combo of combos) {
    assertEquals(
      shouldNotify({ watched_availability: false }, "purchase_arrival", new Set(combo)),
      true,
      `expected notification for ${combo.join("+")}`,
    );
  }
});

Deno.test("title in several non-watched drawers is never suppressed", () => {
  const drawers = new Set(["watchlist", "watching", "custom-1"]);
  for (const type of ["streaming_change", "rental_arrival", "purchase_arrival"]) {
    assertEquals(shouldNotify({ watched_availability: false }, type, drawers), true);
  }
});

Deno.test("shared/custom drawer ids containing the word watched are not treated as watched", () => {
  assertEquals(
    shouldNotify({ watched_availability: false }, "streaming_change", new Set(["rewatched"])),
    true,
  );
  assertEquals(
    shouldNotify({ watched_availability: false }, "streaming_change", new Set(["watched-2024"])),
    true,
  );
});

Deno.test("per-user drawer maps keep suppression independent between users", () => {
  const byUser = new Map<string, Set<string>>([
    ["user-a", new Set(["watched"])],
    ["user-b", new Set(["watched", "watchlist"])],
  ]);
  assertEquals(shouldNotify(undefined, "streaming_change", byUser.get("user-a")), false);
  assertEquals(shouldNotify(undefined, "streaming_change", byUser.get("user-b")), true);
});
