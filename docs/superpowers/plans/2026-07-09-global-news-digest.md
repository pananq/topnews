# Global News Digest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify a GitHub Pages website that displays a Chinese-language daily top-10 global news digest generated from multi-language RSS sources every morning at 8:00 Beijing time.

**Architecture:** A static Vite front end reads `data/latest.json`. Node scripts fetch RSS feeds, normalize and cluster articles, rank top events, optionally call the OpenAI Responses API for Chinese structured summaries, validate the output, and write `data/latest.json`. GitHub Actions runs tests and generation on a UTC 0:00 schedule.

**Tech Stack:** TypeScript, Vite, Vitest, Node 20+, RSS Parser, Zod, GitHub Actions, OpenAI Responses API via `fetch`.

## Global Constraints

- Deploy on GitHub Pages.
- Update every morning at 8:00 Beijing time.
- Use a 24-hour content window.
- Display in Chinese.
- Accept multi-language news sources and preserve original links.
- Treat the top 10 as events, not individual articles.
- Use RSS multi-source aggregation, GitHub Actions, and AI Chinese summaries.
- Keep API keys in GitHub Secrets only.
- Provide sample data so the static site works without an API key.
- Test data schema, RSS parsing, clustering, ranking, front-end states, and build output.

---

### Task 1: Project Scaffold And Data Schema

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/shared/schema.ts`
- Create: `src/shared/categories.ts`
- Create: `src/shared/sampleData.ts`
- Create: `tests/schema.test.ts`
- Create: `data/latest.json`

**Interfaces:**
- Produces: `LatestNewsSchema`, `EventSchema`, `SourceSchema`, `LatestNews`, `NewsEvent`, `NewsSource`
- Produces: `CATEGORIES: readonly string[]`
- Produces: `SAMPLE_LATEST_NEWS: LatestNews`

- [ ] **Step 1: Write failing schema tests**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/schema.test.ts`
Expected: FAIL because project files and schema do not exist yet.

- [ ] **Step 3: Implement scaffold, schema, categories, and sample data**

Create a Vite TypeScript project, define Zod schemas for the JSON contract, define Chinese categories, and create a ten-event `data/latest.json` sample.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/schema.test.ts`
Expected: PASS with 2 tests.

### Task 2: News Pipeline Core

**Files:**
- Create: `src/pipeline/types.ts`
- Create: `src/pipeline/time.ts`
- Create: `src/pipeline/normalize.ts`
- Create: `src/pipeline/cluster.ts`
- Create: `src/pipeline/rank.ts`
- Create: `src/pipeline/sources.ts`
- Create: `tests/pipeline.test.ts`

**Interfaces:**
- Consumes: `NewsEvent` from `src/shared/schema.ts`
- Produces: `normalizeArticle(raw, source): NormalizedArticle | null`
- Produces: `isWithinWindow(publishedAt, now, hours): boolean`
- Produces: `clusterArticles(articles): NewsCluster[]`
- Produces: `rankClusters(clusters, now): RankedCluster[]`

- [ ] **Step 1: Write failing pipeline tests**

```ts
import { describe, expect, it } from "vitest";
import { clusterArticles } from "../src/pipeline/cluster";
import { isWithinWindow } from "../src/pipeline/time";
import { rankClusters } from "../src/pipeline/rank";
import type { NormalizedArticle } from "../src/pipeline/types";

const now = new Date("2026-07-09T00:00:00.000Z");

describe("news pipeline", () => {
  it("filters articles to the past 24 hours", () => {
    expect(isWithinWindow("2026-07-08T12:00:00.000Z", now, 24)).toBe(true);
    expect(isWithinWindow("2026-07-07T23:59:59.000Z", now, 24)).toBe(false);
  });

  it("clusters similar reports into the same event", () => {
    const articles: NormalizedArticle[] = [
      article("Reuters", "en", "US Senate passes landmark AI safety bill", "Lawmakers passed a major artificial intelligence safety bill."),
      article("BBC", "en", "Senate approves major AI safety legislation", "The bill creates new rules for artificial intelligence systems."),
      article("NHK", "ja", "Japan issues tsunami warning after strong quake", "A powerful earthquake triggered coastal warnings."),
    ];

    const clusters = clusterArticles(articles);

    expect(clusters).toHaveLength(2);
    expect(clusters[0].articles).toHaveLength(2);
    expect(clusters[1].articles).toHaveLength(1);
  });

  it("ranks multi-source cross-region clusters above single-source clusters", () => {
    const clusters = clusterArticles([
      article("Reuters", "en", "Global markets rally after central bank signal", "Investors reacted to rate cut signals.", "Americas"),
      article("DW", "de", "Markets rise after central bank signal", "European investors also welcomed the signal.", "Europe"),
      article("Local Blog", "en", "Small city opens new library", "A local update.", "Americas", 0.2),
    ]);

    const ranked = rankClusters(clusters, now);

    expect(ranked[0].articles.length).toBe(2);
    expect(ranked[0].heat.score).toBeGreaterThan(ranked[1].heat.score);
  });
});

function article(
  sourceName: string,
  language: string,
  title: string,
  summary: string,
  region = "Global",
  weight = 1,
): NormalizedArticle {
  return {
    id: `${sourceName}-${title}`,
    sourceName,
    sourceUrl: "https://example.com",
    sourceWeight: weight,
    sourceRegion: region,
    language,
    title,
    summary,
    url: `https://example.com/${encodeURIComponent(title)}`,
    publishedAt: "2026-07-08T18:00:00.000Z",
    categoryHint: "国际",
    keywords: [],
  };
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/pipeline.test.ts`
Expected: FAIL because pipeline modules do not exist yet.

- [ ] **Step 3: Implement pipeline core**

Implement time filtering, normalization helpers, keyword extraction, simple Jaccard title/summary clustering, source diversity, region diversity, freshness, and category-keyword ranking.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/pipeline.test.ts`
Expected: PASS with 3 tests.

### Task 3: AI Summary And Data Generation

**Files:**
- Create: `src/pipeline/aiSummaries.ts`
- Create: `src/pipeline/generateLatest.ts`
- Create: `scripts/generate-news.ts`
- Create: `scripts/validate-data.ts`
- Create: `tests/generateLatest.test.ts`

**Interfaces:**
- Consumes: `RankedCluster[]`
- Produces: `summarizeClusters(clusters, options): Promise<NewsEvent[]>`
- Produces: `generateLatestNews(options): Promise<LatestNews>`

- [ ] **Step 1: Write failing generation tests**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/generateLatest.test.ts`
Expected: FAIL because generation modules do not exist yet.

- [ ] **Step 3: Implement AI and fallback generation**

Implement OpenAI Responses API calls with strict JSON schema when `OPENAI_API_KEY` exists, deterministic Chinese fallback summaries when it does not, and JSON file validation scripts.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/generateLatest.test.ts`
Expected: PASS with fallback behavior.

### Task 4: Static Front End

**Files:**
- Create: `src/main.ts`
- Create: `src/styles.css`
- Create: `tests/frontend.test.ts`

**Interfaces:**
- Consumes: `data/latest.json`
- Produces: browser UI with status, category filters, top 10 event cards, sidebar summary, and source links.

- [ ] **Step 1: Write failing front-end tests**

```ts
import { describe, expect, it } from "vitest";
import { getCategoryCounts, renderStatusLabel } from "../src/main";
import latest from "../data/latest.json";

describe("front-end helpers", () => {
  it("renders Chinese status labels", () => {
    expect(renderStatusLabel("fresh")).toBe("数据已更新");
    expect(renderStatusLabel("sample")).toBe("样例数据");
    expect(renderStatusLabel("stale")).toBe("使用上一版数据");
  });

  it("counts event categories for the sidebar", () => {
    const counts = getCategoryCounts(latest.events);
    expect(counts["政治"]).toBeGreaterThan(0);
    expect(Object.values(counts).reduce((sum, count) => sum + count, 0)).toBe(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/frontend.test.ts`
Expected: FAIL because front-end helpers do not exist yet.

- [ ] **Step 3: Implement the static UI**

Implement an information-dense Chinese news dashboard with responsive layout, category filters, status labels, and source links.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/frontend.test.ts`
Expected: PASS with 2 tests.

### Task 5: GitHub Actions And Final Verification

**Files:**
- Create: `.github/workflows/update-news.yml`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- Produces: `npm run test`, `npm run build`, `npm run generate`, `npm run validate:data`
- Produces: scheduled workflow at cron `0 0 * * *`

- [ ] **Step 1: Write failing workflow/config tests**

```ts
import { describe, expect, it } from "vitest";
import fs from "node:fs";

describe("GitHub Actions workflow", () => {
  it("runs every day at UTC midnight for Beijing 8 AM", () => {
    const workflow = fs.readFileSync(".github/workflows/update-news.yml", "utf8");
    expect(workflow).toContain("0 0 * * *");
    expect(workflow).toContain("npm run generate");
    expect(workflow).toContain("OPENAI_API_KEY");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/workflow.test.ts`
Expected: FAIL because the workflow does not exist yet.

- [ ] **Step 3: Implement workflow and documentation**

Add the scheduled workflow, npm scripts, README setup notes for GitHub Pages and `OPENAI_API_KEY`, and final package metadata.

- [ ] **Step 4: Run final verification**

Run:

```bash
npm test
npm run validate:data
npm run build
```

Expected: all commands exit 0.
