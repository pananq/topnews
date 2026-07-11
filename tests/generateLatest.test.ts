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
    });

    expect(latest.status).toBe("sample");
    expect(latest.events[0].titleZh).toContain("US Senate passes");
    expect(latest.events[0].summaryZh).toContain("自动摘要");
    expect(latest.events[0].sources[0].url).toBe("https://reuters.com/ai-bill");
  });

  it("uses the resolved cluster category in fallback summaries", async () => {
    const latest = await generateLatestNews({
      now: new Date("2026-07-09T00:00:00.000Z"),
      articles: [
        {
          id: "tech-low-weight",
          sourceName: "Tech Wire",
          sourceUrl: "https://example.com",
          sourceWeight: 0.2,
          sourceRegion: "Global",
          language: "en",
          title: "Global market reacts to policy signal",
          summary: "Investors follow the market reaction.",
          url: "https://example.com/tech",
          publishedAt: "2026-07-08T18:00:00.000Z",
          categoryHint: "科技",
          keywords: [],
        },
        {
          id: "finance-high-weight",
          sourceName: "Finance Desk",
          sourceUrl: "https://example.com",
          sourceWeight: 1.5,
          sourceRegion: "Global",
          language: "en",
          title: "Global market reacts to policy signal",
          summary: "Investors follow the market reaction.",
          url: "https://example.com/finance",
          publishedAt: "2026-07-08T18:00:00.000Z",
          categoryHint: "财经",
          keywords: [],
        },
      ],
      fetchFeeds: false,
    });

    expect(latest.events[0].category).toBe("财经");
  });

  it("uses DeepSeek chat completions when configured as the AI provider", async () => {
    const calls: Array<{ url: string; body: any }> = [];
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
      aiProvider: "deepseek",
      deepseekApiKey: "test-deepseek-key",
      deepseekModel: "deepseek-v4-flash",
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });

        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    events: [
                      {
                        titleZh: "美国参议院通过 AI 安全法案",
                        summaryZh: "美国参议院通过一项人工智能安全法案。该法案为人工智能系统建立新的监管要求。",
                        category: "财经",
                        regions: ["美国"],
                        reasonZh: "多家来源报道了这项 AI 安全立法。",
                      },
                    ],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    });

    expect(calls[0].url).toBe("https://api.deepseek.com/chat/completions");
    expect(calls[0].body.model).toBe("deepseek-v4-flash");
    expect(calls[0].body.response_format).toEqual({ type: "json_object" });
    expect(latest.status).toBe("fresh");
    expect(latest.events[0].titleZh).toBe("美国参议院通过 AI 安全法案");
    expect(latest.events[0].category).toBe("科技");
  });
});
