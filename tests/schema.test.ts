import { describe, expect, it } from "vitest";
import { CATEGORIES } from "../src/shared/categories";
import { SourceSchema, LatestNewsSchema } from "../src/shared/schema";
import latest from "../data/latest.json";

describe("latest news schema", () => {
  it("uses the preferred focus categories only", () => {
    expect(CATEGORIES).toEqual(["科技", "财经", "政治", "国际", "体育"]);
  });

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

  it("rejects source URLs outside http and https", () => {
    expect(() =>
      SourceSchema.parse({
        name: "Bad Source",
        url: "javascript:alert(1)",
        language: "en",
        publishedAt: "2026-07-08T18:00:00.000Z",
      }),
    ).toThrow();

    expect(() =>
      SourceSchema.parse({
        name: "Good Source",
        url: "https://example.com/news",
        language: "en",
        publishedAt: "2026-07-08T18:00:00.000Z",
      }),
    ).not.toThrow();
  });
});
