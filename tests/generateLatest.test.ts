import { describe, expect, it } from "vitest";
import { generateLatestNews } from "../src/pipeline/generateLatest";

describe("generateLatestNews", () => {
  it("falls back to deterministic Chinese summaries when no OpenAI API key is present", async () => {
    const latest = await generateLatestNews({
      now: new Date("2026-07-09T00:00:00.000Z"),
      articles: [
        {
          id: "1",
          sourceName: "Reuters",
          sourceUrl: "https://reuters.com",
          sourceWeight: 1.3,
          sourceRegion: "Americas",
          language: "en",
          title: "US Senate passes landmark AI safety bill",
          summary: "Lawmakers passed a major artificial intelligence safety bill.",
          url: "https://reuters.com/ai-bill",
          publishedAt: "2026-07-08T18:00:00.000Z",
          categoryHint: "科技",
          keywords: [],
        },
      ],
      fetchFeeds: false,
      apiKey: "",
    });

    expect(latest.status).toBe("sample");
    expect(latest.events[0].titleZh).toContain("US Senate passes");
    expect(latest.events[0].summaryZh).toContain("自动摘要");
    expect(latest.events[0].sources[0].url).toBe("https://reuters.com/ai-bill");
  });
});
