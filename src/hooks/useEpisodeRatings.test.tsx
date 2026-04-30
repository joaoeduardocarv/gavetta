/**
 * Tests for useEpisodeRatings — focus on the manual upsert path that handles
 * NULL season_number / episode_number correctly.
 *
 * Why this matters: the unique index in Postgres uses
 *   COALESCE(season_number, -1), COALESCE(episode_number, -1)
 * so `ON CONFLICT (cols...)` can't match it. We use UPDATE-then-INSERT instead.
 *
 * These tests guarantee:
 *   - Series-level rating (both NULL)   — UPDATE uses .is(null), then INSERT if missing.
 *   - Season-level rating (ep NULL)     — same pattern, season filtered with .eq().
 *   - Episode-level rating (both set)   — UPDATE then INSERT with .eq() everywhere.
 *   - Existing rows are UPDATED (no duplicate INSERT).
 *   - Optimistic value never reverts to "—" when the DB call succeeds.
 *   - On DB failure, value reverts (so UI shows previous state, not stale).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// ---------- Mock setup MUST come before importing the hook ----------

const mockUser = { id: "user-123" };

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mockUser }),
}));

// We'll capture every chained call to inspect filter usage (.is vs .eq).
type CallLog = {
  table?: string;
  op?: "select" | "update" | "insert" | "delete" | "upsert";
  filters: Array<{ kind: "eq" | "is"; col: string; val: unknown }>;
  payload?: unknown;
};

let callLog: CallLog[] = [];

// `selectResult` — what the UPDATE...select() resolves to (controls UPDATE-vs-INSERT branching).
let selectResult: { data: Array<{ id: string }> | null; error: unknown } = {
  data: [],
  error: null,
};
let insertResult: { error: unknown } = { error: null };
let deleteResult: { error: unknown } = { error: null };
// Initial fetch on mount.
let initialFetchResult: { data: unknown[]; error: unknown } = {
  data: [],
  error: null,
};

function makeBuilder(current: CallLog) {
  // Returns a thenable proxy: each chained method records, returns self.
  // Awaiting resolves to the appropriate result based on `op`.
  const builder: any = {
    eq(col: string, val: unknown) {
      current.filters.push({ kind: "eq", col, val });
      return builder;
    },
    is(col: string, val: unknown) {
      current.filters.push({ kind: "is", col, val });
      return builder;
    },
    select(_cols?: string) {
      // For UPDATE...select(), keep op as "update" but mark that we expect rows back.
      if (!current.op) current.op = "select";
      return builder;
    },
    then(resolve: (v: unknown) => void) {
      if (current.op === "select") {
        resolve(initialFetchResult);
      } else if (current.op === "update") {
        resolve(selectResult);
      } else if (current.op === "insert") {
        resolve(insertResult);
      } else if (current.op === "delete") {
        resolve(deleteResult);
      } else {
        resolve({ data: null, error: null });
      }
    },
  };
  return builder;
}

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from(table: string) {
        const current: CallLog = { table, filters: [] };
        const builder = makeBuilder(current);

        const wrap = (op: CallLog["op"], payload?: unknown) => {
          current.op = op;
          if (payload !== undefined) current.payload = payload;
          callLog.push(current);
          return builder;
        };

        return {
          select: (cols?: string) => wrap("select"),
          update: (payload: unknown) => wrap("update", payload),
          insert: (payload: unknown) => wrap("insert", payload),
          delete: () => wrap("delete"),
          upsert: (payload: unknown, _opts?: unknown) => wrap("upsert", payload),
        };
      },
    },
  };
});

// Now safe to import the hook.
import { useEpisodeRatings } from "./useEpisodeRatings";

beforeEach(() => {
  callLog = [];
  selectResult = { data: [], error: null };
  insertResult = { error: null };
  deleteResult = { error: null };
  initialFetchResult = { data: [], error: null };
});

// ---------- Helpers ----------

async function mountHook(tmdbTvId: number | null = 100) {
  const view = renderHook(() => useEpisodeRatings(tmdbTvId));
  // Wait for initial fetch to settle.
  await waitFor(() => expect(view.result.current.isLoading).toBe(false));
  // Clear log entries from initial mount fetch so each test starts clean.
  callLog = [];
  return view;
}

function findCalls(op: CallLog["op"]) {
  return callLog.filter((c) => c.op === op);
}

function hasFilter(
  call: CallLog,
  kind: "eq" | "is",
  col: string,
  val?: unknown
) {
  return call.filters.some(
    (f) =>
      f.kind === kind && f.col === col && (val === undefined || f.val === val)
  );
}

// ---------- Tests ----------

describe("useEpisodeRatings — manual upsert with NULL scopes", () => {
  describe("Series-level (season=null, episode=null)", () => {
    it("INSERTs a new row when no existing row matches", async () => {
      selectResult = { data: [], error: null }; // nothing to update

      const { result } = await mountHook();
      await act(async () => {
        await result.current.setSeriesRating(9);
      });

      const updates = findCalls("update");
      const inserts = findCalls("insert");

      expect(updates).toHaveLength(1);
      expect(hasFilter(updates[0], "is", "season_number", null)).toBe(true);
      expect(hasFilter(updates[0], "is", "episode_number", null)).toBe(true);

      expect(inserts).toHaveLength(1);
      expect(inserts[0].payload).toMatchObject({
        user_id: "user-123",
        tmdb_tv_id: 100,
        season_number: null,
        episode_number: null,
        rating: 9,
      });

      // Optimistic value persists — never reverts to null/"—"
      expect(result.current.getStoredSeriesRating()).toBe(9);
    });

    it("UPDATEs (no INSERT) when a series row already exists", async () => {
      selectResult = { data: [{ id: "row-existing" }], error: null };

      const { result } = await mountHook();
      await act(async () => {
        await result.current.setSeriesRating(7);
      });

      expect(findCalls("update")).toHaveLength(1);
      expect(findCalls("insert")).toHaveLength(0);
      expect(result.current.getStoredSeriesRating()).toBe(7);
    });
  });

  describe("Season-level (season set, episode=null)", () => {
    it("uses .eq for season and .is(null) for episode", async () => {
      selectResult = { data: [], error: null };

      const { result } = await mountHook();
      await act(async () => {
        await result.current.setSeasonRating(1, 10);
      });

      const upd = findCalls("update")[0];
      expect(hasFilter(upd, "eq", "season_number", 1)).toBe(true);
      expect(hasFilter(upd, "is", "episode_number", null)).toBe(true);

      const ins = findCalls("insert")[0];
      expect(ins.payload).toMatchObject({
        season_number: 1,
        episode_number: null,
        rating: 10,
      });

      // The whole point of this fix: 10/10 must persist, never "—"
      expect(result.current.getStoredSeasonRating(1)).toBe(10);
    });

    it("UPDATE-only when row exists; chip stays at the new value", async () => {
      selectResult = { data: [{ id: "row-1" }], error: null };

      const { result } = await mountHook();
      await act(async () => {
        await result.current.setSeasonRating(2, 6);
      });

      expect(findCalls("update")).toHaveLength(1);
      expect(findCalls("insert")).toHaveLength(0);
      expect(result.current.getStoredSeasonRating(2)).toBe(6);
    });
  });

  describe("Episode-level (both set)", () => {
    it("uses .eq for both season and episode and inserts when missing", async () => {
      selectResult = { data: [], error: null };

      const { result } = await mountHook();
      await act(async () => {
        await result.current.setEpisodeRating(3, 5, 8);
      });

      const upd = findCalls("update")[0];
      expect(hasFilter(upd, "eq", "season_number", 3)).toBe(true);
      expect(hasFilter(upd, "eq", "episode_number", 5)).toBe(true);

      const ins = findCalls("insert")[0];
      expect(ins.payload).toMatchObject({
        season_number: 3,
        episode_number: 5,
        rating: 8,
      });
      expect(result.current.getStoredEpisodeRating(3, 5)).toBe(8);
    });
  });

  describe("Failure handling", () => {
    it("reverts the optimistic value when UPDATE errors out", async () => {
      selectResult = { data: null, error: { message: "boom" } };

      const { result } = await mountHook();
      await act(async () => {
        await result.current.setSeasonRating(1, 10);
      });

      // Reverted to nothing (no previous value).
      expect(result.current.getStoredSeasonRating(1)).toBeUndefined();
      // No INSERT attempted after UPDATE error.
      expect(findCalls("insert")).toHaveLength(0);
    });

    it("reverts when INSERT errors out (UPDATE returned 0 rows)", async () => {
      selectResult = { data: [], error: null };
      insertResult = { error: { message: "insert failed" } };

      const { result } = await mountHook();
      await act(async () => {
        await result.current.setSeriesRating(4);
      });

      expect(result.current.getStoredSeriesRating()).toBeUndefined();
    });

    it("preserves the previous value on failure (does not blank out)", async () => {
      // Seed initial fetch with an existing series rating.
      initialFetchResult = {
        data: [{ season_number: null, episode_number: null, rating: 5 }],
        error: null,
      };
      selectResult = { data: null, error: { message: "nope" } };

      const { result } = await mountHook();
      expect(result.current.getStoredSeriesRating()).toBe(5);

      await act(async () => {
        await result.current.setSeriesRating(9);
      });

      // Reverts to 5, not null — chip never shows "—" if there was a value.
      expect(result.current.getStoredSeriesRating()).toBe(5);
    });
  });

  describe("Delete path (value=null)", () => {
    it("series-level delete uses .is(null) for both columns", async () => {
      const { result } = await mountHook();
      await act(async () => {
        await result.current.setSeriesRating(null);
      });

      const del = findCalls("delete")[0];
      expect(del).toBeDefined();
      expect(hasFilter(del, "is", "season_number", null)).toBe(true);
      expect(hasFilter(del, "is", "episode_number", null)).toBe(true);
    });

    it("season-level delete uses .eq(season) and .is(episode null)", async () => {
      const { result } = await mountHook();
      await act(async () => {
        await result.current.setSeasonRating(2, null);
      });

      const del = findCalls("delete")[0];
      expect(hasFilter(del, "eq", "season_number", 2)).toBe(true);
      expect(hasFilter(del, "is", "episode_number", null)).toBe(true);
    });
  });
});
