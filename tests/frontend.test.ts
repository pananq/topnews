import { describe, expect, it } from "vitest";
import latest from "../data/latest.json";
import { getCategoryCounts, renderStatusLabel } from "../src/main";
import { LatestNewsSchema } from "../src/shared/schema";

describe("front-end helpers", () => {
  it("renders Chinese status labels", () => {
    expect(renderStatusLabel("fresh")).toBe("数据已更新");
    expect(renderStatusLabel("sample")).toBe("样例数据");
    expect(renderStatusLabel("stale")).toBe("使用上一版数据");
  });

  it("counts event categories for the sidebar", () => {
    const parsed = LatestNewsSchema.parse(latest);
    const counts = getCategoryCounts(parsed.events);

    expect(counts["政治"]).toBeGreaterThan(0);
    expect(Object.values(counts).reduce((sum, count) => sum + count, 0)).toBe(10);
  });
});
