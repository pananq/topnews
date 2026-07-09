import { describe, expect, it } from "vitest";
import { CATEGORIES } from "../src/shared/categories";
import { LatestNewsSchema } from "../src/shared/schema";
import latest from "../data/latest.json";

describe("latest news schema", () => {
  it("accepts the bundled sample latest.json with ten ranked events", () => {
    const parsed = LatestNewsSchema.parse(latest);

    expect(parsed.timezone).toBe("Asia/Shanghai");
    expect(parsed.windowHours).toBe(24);
    expect(parsed.events).toHaveLength(10);
    expect(parsed.events.map((event) => event.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("only uses supported categories", () => {
    const parsed = LatestNewsSchema.parse(latest);

    for (const event of parsed.events) {
      expect(CATEGORIES).toContain(event.category);
    }
  });
});
