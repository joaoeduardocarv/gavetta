import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { hasVisitedThisSession, markSessionVisited } from "./sessionVisit";

const VISIT_KEY = "gavetta:session-visited";

describe("sessionVisit", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("hasVisitedThisSession", () => {
    it("returns false on a brand new session", () => {
      expect(hasVisitedThisSession()).toBe(false);
    });

    it("returns true after markSessionVisited()", () => {
      markSessionVisited();
      expect(hasVisitedThisSession()).toBe(true);
    });

    it("returns true when sessionStorage throws (privacy mode fallback)", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("SecurityError");
      });
      // Fail-safe: trata como visitado para evitar loop em /welcome.
      expect(hasVisitedThisSession()).toBe(true);
    });

    it("returns false when sessionStorage has unrelated keys", () => {
      sessionStorage.setItem("other-key", "value");
      expect(hasVisitedThisSession()).toBe(false);
    });
  });

  describe("markSessionVisited", () => {
    it("persists the visited flag in sessionStorage", () => {
      markSessionVisited();
      expect(sessionStorage.getItem(VISIT_KEY)).toBe("1");
    });

    it("is idempotent across multiple calls", () => {
      markSessionVisited();
      markSessionVisited();
      markSessionVisited();
      expect(sessionStorage.getItem(VISIT_KEY)).toBe("1");
      expect(hasVisitedThisSession()).toBe(true);
    });

    it("does not throw when sessionStorage is unavailable", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
      expect(() => markSessionVisited()).not.toThrow();
    });
  });

  describe("session lifecycle (simulating browser close/reopen)", () => {
    it("flag is gone after sessionStorage.clear() (simulates new browser session)", () => {
      markSessionVisited();
      expect(hasVisitedThisSession()).toBe(true);

      // sessionStorage.clear() simula o usuário fechando e reabrindo o navegador.
      sessionStorage.clear();

      expect(hasVisitedThisSession()).toBe(false);
    });

    it("survives within the same session (simulates page refresh)", () => {
      markSessionVisited();
      // Refresh não limpa sessionStorage — flag deve persistir.
      expect(hasVisitedThisSession()).toBe(true);
    });
  });
});
