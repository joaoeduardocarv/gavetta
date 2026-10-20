import { describe, expect, it } from "vitest";
import { mondayOf, summarizeMarketing, projectConversions, validMarketingInput } from "./marketingMix";

describe("marketing observations", () => {
  it("groups weekly observations without multiplying conversions", () => {
    const result = summarizeMarketing([
      { id: "1", week_start: "2026-10-12", channel: "Meta", spend: 100, conversions: 10, revenue: 200 },
      { id: "2", week_start: "2026-10-19", channel: "Meta", spend: 300, conversions: 10, revenue: 600 },
    ]);
    expect(result[0]).toMatchObject({ spend: 400, conversions: 20, cpa: 20, roas: 2, weeks: 2 });
  });
  it("normalizes dates to the start of the week", () => expect(mondayOf("2026-10-20")).toBe("2026-10-19"));
  it("uses a historical ratio for scenarios", () => expect(projectConversions(400, 20, 600)).toBe(30));
  it("does not invent efficiency for channels without spend", () => expect(projectConversions(0, 20, 600)).toBeNull());
  it("does not invent conversions for channels without conversions", () => expect(projectConversions(400, 0, 600)).toBeNull());
  it("rejects negative investment", () => expect(validMarketingInput(-1, 10, 20)).toBe(false));
  it("rejects fractional conversions", () => expect(validMarketingInput(100, 1.5, 20)).toBe(false));
});