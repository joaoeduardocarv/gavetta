import { describe, it, expect, vi, beforeEach } from "vitest";
import { isNewAccount, trackChatGptSignup } from "./chatgptAdsPixel";

describe("ChatGPT Ads signup conversion", () => {
  beforeEach(() => localStorage.clear());

  it("counts accounts created within 48h only", () => {
    const now = Date.parse("2026-11-09T12:00:00Z");
    expect(isNewAccount({ created_at: "2026-11-08T13:00:00Z" }, now)).toBe(true);
    expect(isNewAccount({ created_at: "2026-11-01T12:00:00Z" }, now)).toBe(false);
  });

  it("sends registration_completed once per new account", () => {
    const oaiq = vi.fn();
    (window as unknown as { oaiq: unknown }).oaiq = oaiq;
    const user = { id: "u1", created_at: new Date().toISOString() };
    trackChatGptSignup(user);
    trackChatGptSignup(user);
    expect(oaiq).toHaveBeenCalledTimes(1);
    expect(oaiq).toHaveBeenCalledWith("measure", "registration_completed", { type: "customer_action" }, { event_id: "signup-u1" });
  });

  it("does not send for old accounts", () => {
    const oaiq = vi.fn();
    (window as unknown as { oaiq: unknown }).oaiq = oaiq;
    trackChatGptSignup({ id: "u2", created_at: "2020-01-01T00:00:00Z" });
    expect(oaiq).not.toHaveBeenCalled();
  });
});
