import { describe, expect, it } from "vitest";
import latest from "../data/latest.json";
import { getCategoryCounts, renderEvent, renderStatusLabel } from "../src/main";
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

    expect(Object.values(counts).reduce((sum, count) => sum + count, 0)).toBe(10);
    expect(Object.values(counts).some((count) => count > 0)).toBe(true);
  });

  it("escapes source URLs before rendering href attributes", () => {
    const event = {
      ...LatestNewsSchema.parse(latest).events[0],
      sources: [
        {
          name: "Injected Source",
          url: "https://example.com/?q=\" onclick=\"alert(1)",
          language: "en",
          publishedAt: "2026-07-08T18:00:00.000Z",
        },
      ],
    };

    const html = renderEvent(event);

    expect(html).toContain('href="https://example.com/?q=&quot; onclick=&quot;alert(1)"');
    expect(html).not.toContain('href="https://example.com/?q=" onclick="alert(1)"');
  });
});
