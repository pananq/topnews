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
    expect(latest.events[0].titleZh).not.toMatch(/[A-Za-z0-9]/);
    expect(latest.events[0].summaryZh).not.toMatch(/[A-Za-z0-9]/);
    expect(latest.events[0].summaryZh).toContain("自动摘要");
    expect(latest.events[0].regions).toEqual(["美洲"]);
    expect(latest.events[0].sources[0].url).toBe("https://reuters.com/ai-bill");
  });

  it("marks provider failures as sample and uses deterministic Chinese fallback fields", async () => {
    const latest = await generateLatestNews({
      now: new Date("2026-07-09T00:00:00.000Z"),
      articles: [testArticle()],
      fetchFeeds: false,
      aiProvider: "openai",
      openaiApiKey: "test-openai-key",
      fetchImpl: async () => new Response("provider unavailable", { status: 500 }),
    });

    expect(latest.status).toBe("sample");
    expect(latest.events[0].titleZh).not.toMatch(/[A-Za-z0-9]/);
    expect(latest.events[0].summaryZh).not.toMatch(/[A-Za-z0-9]/);
    expect(latest.events[0].regions).toEqual(["美洲"]);
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

  it.each([0, 1, 3])("falls back the entire batch when DeepSeek returns %s summaries for two clusters", async (summaryCount) => {
    const articles = [
      testArticle(),
      {
        ...testArticle(),
        id: "2",
        sourceName: "Finance Wire",
        sourceUrl: "https://finance.example.com",
        sourceRegion: "Europe",
        title: "Central bank cuts rates as inflation slows",
        summary: "Policymakers reduced interest rates after inflation eased.",
        url: "https://finance.example.com/rates",
        categoryHint: "财经" as const,
      },
    ];
    const returnedSummaries = Array.from({ length: summaryCount }, (_, index) => ({
      clusterId: String(index + 1),
      titleZh: `供应商摘要${index}`,
      summaryZh: `供应商返回的第${index}条摘要。`,
      regions: ["全球"],
      reasonZh: "供应商热度说明。",
    }));
    const latest = await generateLatestNews({
      now: new Date("2026-07-09T00:00:00.000Z"),
      articles,
      fetchFeeds: false,
      aiProvider: "deepseek",
      deepseekApiKey: "test-deepseek-key",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify({ events: returnedSummaries }) } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    });

    expect(latest.status).toBe("sample");
    expect(latest.events.slice(0, 2).every((event) => event.summaryZh.includes("自动摘要"))).toBe(true);
    expect(new Set(latest.events.slice(0, 2).flatMap((event) => event.sources.map((source) => source.url)))).toEqual(
      new Set(["https://reuters.com/ai-bill", "https://finance.example.com/rates"]),
    );
  });

  it("falls back the entire batch when DeepSeek returns a correct-count malformed summary", async () => {
    const latest = await generateLatestNews({
      now: new Date("2026-07-09T00:00:00.000Z"),
      articles: [testArticle()],
      fetchFeeds: false,
      aiProvider: "deepseek",
      deepseekApiKey: "test-deepseek-key",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    events: [
                      {
                        clusterId: "1",
                        titleZh: 42,
                        summaryZh: "供应商返回了类型错误的标题。",
                        regions: ["美国"],
                        reasonZh: "供应商热度说明。",
                      },
                    ],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    });

    expect(latest.status).toBe("sample");
    expect(latest.events[0].summaryZh).toContain("自动摘要");
    expect(latest.events[0].sources[0].url).toBe("https://reuters.com/ai-bill");
  });

  it.each([
    ["duplicate", ["1", "1"]],
    ["unknown", ["1", "unknown-cluster"]],
  ])("falls back the entire batch when DeepSeek returns %s cluster ids", async (_caseName, clusterIds) => {
    const articles = [
      testArticle(),
      {
        ...testArticle(),
        id: "2",
        sourceName: "Finance Wire",
        sourceUrl: "https://finance.example.com",
        sourceRegion: "Europe",
        title: "Central bank cuts rates as inflation slows",
        summary: "Policymakers reduced interest rates after inflation eased.",
        url: "https://finance.example.com/rates",
        categoryHint: "财经" as const,
      },
    ];
    const latest = await generateLatestNews({
      now: new Date("2026-07-09T00:00:00.000Z"),
      articles,
      fetchFeeds: false,
      aiProvider: "deepseek",
      deepseekApiKey: "test-deepseek-key",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    events: clusterIds.map((clusterId, index) => ({
                      clusterId,
                      titleZh: `供应商摘要${index}`,
                      summaryZh: `供应商返回的第${index}条摘要。`,
                      regions: ["全球"],
                      reasonZh: "供应商热度说明。",
                    })),
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    });

    expect(latest.status).toBe("sample");
    expect(latest.events.slice(0, 2).every((event) => event.summaryZh.includes("自动摘要"))).toBe(true);
  });

  it("falls back when DeepSeek returns a category field instead of summarizing only", async () => {
    const latest = await generateLatestNews({
      now: new Date("2026-07-09T00:00:00.000Z"),
      articles: [testArticle()],
      fetchFeeds: false,
      aiProvider: "deepseek",
      deepseekApiKey: "test-deepseek-key",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    events: [
                      {
                        clusterId: "1",
                        titleZh: "美国参议院通过人工智能安全法案",
                        summaryZh: "美国参议院通过人工智能安全法案。法案将建立新的监管要求。",
                        category: "财经",
                        regions: ["美国"],
                        reasonZh: "多家来源集中报道。",
                      },
                    ],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    });

    expect(latest.status).toBe("sample");
    expect(latest.events[0].category).toBe("科技");
    expect(latest.events[0].summaryZh).toContain("自动摘要");
  });

  it("falls back when DeepSeek returns schema-valid English summary fields", async () => {
    const latest = await generateLatestNews({
      now: new Date("2026-07-09T00:00:00.000Z"),
      articles: [testArticle()],
      fetchFeeds: false,
      aiProvider: "deepseek",
      deepseekApiKey: "test-deepseek-key",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    events: [
                      {
                        clusterId: "1",
                        titleZh: "US Senate passes AI safety bill",
                        summaryZh: "The US Senate passed an artificial intelligence safety bill with new regulatory requirements.",
                        regions: ["United States"],
                        reasonZh: "Multiple sources reported the AI legislation.",
                      },
                    ],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    });

    expect(latest.status).toBe("sample");
    expect(latest.events[0].summaryZh).toContain("自动摘要");
  });

  it("falls back when DeepSeek returns mostly English fields with only token Chinese", async () => {
    const latest = await generateLatestNews({
      now: new Date("2026-07-09T00:00:00.000Z"),
      articles: [testArticle()],
      fetchFeeds: false,
      aiProvider: "deepseek",
      deepseekApiKey: "test-deepseek-key",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    events: [
                      {
                        clusterId: "1",
                        titleZh: "US Senate passes AI safety bill 法案",
                        summaryZh: "The US Senate passed an AI safety bill 法案 with new regulatory requirements.",
                        regions: ["美国"],
                        reasonZh: "Multiple sources reported the legislation 热点.",
                      },
                    ],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    });

    expect(latest.status).toBe("sample");
    expect(latest.events[0].summaryZh).toContain("自动摘要");
  });

  it("falls back when DeepSeek returns non-Chinese or markup-bearing regions", async () => {
    const latest = await generateLatestNews({
      now: new Date("2026-07-09T00:00:00.000Z"),
      articles: [testArticle()],
      fetchFeeds: false,
      aiProvider: "deepseek",
      deepseekApiKey: "test-deepseek-key",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    events: [
                      {
                        clusterId: "1",
                        titleZh: "美国参议院通过人工智能安全法案",
                        summaryZh: "美国参议院通过人工智能安全法案。法案将建立新的监管要求。",
                        regions: ['United States<img src=x onerror="alert(1)">'],
                        reasonZh: "多家来源集中报道这项人工智能立法。",
                      },
                    ],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    });

    expect(latest.status).toBe("sample");
    expect(latest.events[0].regions).toEqual(["美洲"]);
  });

  it("binds DeepSeek summaries to clusters by stable id when the provider reorders events", async () => {
    const calls: Array<{ body: any }> = [];
    const articles = [
      {
        ...testArticle(),
        sourceWeight: 2,
      },
      {
        ...testArticle(),
        id: "2",
        sourceName: "Finance Wire",
        sourceUrl: "https://finance.example.com",
        sourceWeight: 1,
        sourceRegion: "Europe",
        title: "Central bank cuts rates as inflation slows",
        summary: "Policymakers reduced interest rates after inflation eased.",
        url: "https://finance.example.com/rates",
        categoryHint: "财经" as const,
      },
    ];

    const latest = await generateLatestNews({
      now: new Date("2026-07-09T00:00:00.000Z"),
      articles,
      fetchFeeds: false,
      aiProvider: "deepseek",
      deepseekApiKey: "test-deepseek-key",
      fetchImpl: async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        calls.push({ body });
        const prompt = JSON.parse(body.messages[1].content);

        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    events: [
                      {
                        clusterId: prompt.clusters[1].clusterId,
                        titleZh: "央行降息推动市场关注",
                        summaryZh: "央行在通胀放缓后降息。投资者关注后续政策路径。",
                        regions: ["欧洲"],
                        reasonZh: "财经来源报道了降息事件。",
                      },
                      {
                        clusterId: prompt.clusters[0].clusterId,
                        titleZh: "美国参议院通过人工智能安全法案",
                        summaryZh: "美国参议院通过人工智能安全法案。法案将建立新的监管要求。",
                        regions: ["美国"],
                        reasonZh: "多家来源集中报道。",
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

    const prompt = JSON.parse(calls[0].body.messages[1].content);
    expect(prompt.clusters.map((cluster: { clusterId?: string }) => cluster.clusterId)).toEqual(["1", "2"]);
    expect(latest.status).toBe("partial");
    expect(latest.events[0].titleZh).toBe("美国参议院通过人工智能安全法案");
    expect(latest.events[0].sources[0].url).toBe("https://reuters.com/ai-bill");
    expect(latest.events[1].titleZh).toBe("央行降息推动市场关注");
    expect(latest.events[1].sources[0].url).toBe("https://finance.example.com/rates");
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
                        clusterId: "1",
                        titleZh: "美国参议院通过 AI 安全法案",
                        summaryZh: "美国参议院通过一项人工智能安全法案。该法案为人工智能系统建立新的监管要求。",
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
    const prompt = JSON.parse(calls[0].body.messages[1].content);
    expect(prompt.clusters[0].clusterId).toBe("1");
    expect(prompt.clusters[0].category).toBe("科技");
    expect(prompt.instruction).toContain("不要输出分类字段");
    expect(latest.status).toBe("partial");
    expect(latest.events[0].titleZh).toBe("美国参议院通过 AI 安全法案");
    expect(latest.events[0].category).toBe("科技");
  });

  it("marks successful generation as partial when sample filler is needed", async () => {
    const latest = await generateLatestNews({
      now: new Date("2026-07-09T00:00:00.000Z"),
      articles: [testArticle()],
      fetchFeeds: false,
      aiProvider: "deepseek",
      deepseekApiKey: "test-deepseek-key",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    events: [
                      {
                        clusterId: "1",
                        titleZh: "美国参议院通过人工智能安全法案",
                        summaryZh: "美国参议院通过人工智能安全法案。法案将建立新的监管要求。",
                        regions: ["美国"],
                        reasonZh: "多家来源集中报道。",
                      },
                    ],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    });

    expect(latest.events).toHaveLength(10);
    expect(latest.events[0].sources[0].url).toBe("https://reuters.com/ai-bill");
    expect(latest.status).toBe("partial");
  });

  it("uses the OpenAI Responses API contract and preserves the preclassified category", async () => {
    const calls: Array<{ url: string; body: any }> = [];
    const latest = await generateLatestNews({
      now: new Date("2026-07-09T00:00:00.000Z"),
      articles: [testArticle()],
      fetchFeeds: false,
      aiProvider: "openai",
      openaiApiKey: "test-openai-key",
      openaiModel: "gpt-test-model",
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });

        return new Response(
          JSON.stringify({
            output: [
              {
                type: "message",
                content: [
                  {
                    type: "output_text",
                    text: JSON.stringify({
                      events: [
                        {
                          clusterId: "1",
                          titleZh: "美国参议院通过人工智能安全法案",
                          summaryZh: "美国参议院通过人工智能安全法案。法案将建立新的监管要求。",
                          regions: ["美国"],
                          reasonZh: "多家来源集中报道。",
                        },
                      ],
                    }),
                  },
                ],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.openai.com/v1/responses");
    expect(calls[0].body.model).toBe("gpt-test-model");
    const prompt = JSON.parse(calls[0].body.input[1].content);
    expect(prompt.clusters[0].clusterId).toBe("1");
    expect(prompt.clusters[0].category).toBe("科技");
    expect(prompt.instruction).toContain("不要输出分类字段");
    expect(latest.status).toBe("partial");
    expect(latest.events[0].category).toBe("科技");
  });
});

function testArticle() {
  return {
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
    categoryHint: "科技" as const,
    keywords: [],
  };
}
