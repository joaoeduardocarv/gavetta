import { describe, it, expect } from "vitest";
import { parseUtm } from "./attribution";

describe("parseUtm", () => {
  it("captura source e campaign", () => {
    const r = parseUtm("?utm_source=instagram&utm_campaign=lancamento", "/welcome");
    expect(r?.utm_source).toBe("instagram");
    expect(r?.utm_campaign).toBe("lancamento");
    expect(r?.landing_path).toBe("/welcome");
  });
  it("ignora URLs sem source nem campaign", () => {
    expect(parseUtm("?utm_medium=cpc")).toBeNull();
  });
});
