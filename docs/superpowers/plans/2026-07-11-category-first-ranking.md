# Category-First News Ranking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Select the daily Top 10 only from 科技、财经、政治、国际、体育 candidates, merging economic news into 财经 and preferring one strong event from every available category.

**Architecture:** Classification becomes an eligibility gate during normalization instead of an AI operation after selection. Eligible articles are clustered with a deterministic cluster category, ranked globally, then passed through a pure coverage-aware selector before AI summarization. The summarizer preserves the selected cluster category regardless of provider output.

**Tech Stack:** TypeScript, Vitest, Zod, Vite, RSS Parser, DeepSeek/OpenAI HTTP APIs

## Global Constraints

- Supported categories are exactly 科技、财经、政治、国际、体育.
- Economic, macroeconomic, market, banking, rate, trade, GDP and inflation news maps to 财经.
- Unrecognized articles are ineligible and must be removed before clustering and ranking.
- Category coverage is preferred only when an eligible candidate exists; weak or unrelated news is never added to satisfy coverage.
- DeepSeek remains the default AI provider and OpenAI remains supported.
- The pipeline works deterministically without an AI API key.

---

### Task 1: Category Eligibility During Normalization

**Files:**
- Modify: `src/shared/categories.ts`
- Modify: `src/pipeline/normalize.ts`
- Modify: `src/pipeline/sources.ts`
- Modify: `src/pipeline/socialSources.ts`
- Test: `tests/schema.test.ts`
- Test: `tests/pipeline.test.ts`

**Interfaces:**
- Produces: `inferCategory(text: string): NewsCategory | null`
- Produces: `normalizeArticle(...): NormalizedArticle | null`, returning `null` for articles outside the five categories
- Consumes: narrow-feed `NewsSourceConfig.categoryHint`; broad world feeds have no forced category

- [ ] **Step 1: Write failing category and eligibility tests**

Update `tests/schema.test.ts` to expect exactly five categories:

```ts
expect(CATEGORIES).toEqual(["科技", "财经", "政治", "国际", "体育"]);
```

Add to `tests/pipeline.test.ts`:

```ts
import { inferCategory, normalizeArticle } from "../src/pipeline/normalize";

it("merges economic reporting into finance", () => {
  expect(inferCategory("Central bank cuts interest rates as inflation slows")).toBe("财经");
});

it("rejects articles outside the focus categories before ranking", () => {
  const result = normalizeArticle(
    {
      title: "Local weather service forecasts a rainy weekend",
      link: "https://example.com/weather",
      isoDate: "2026-07-08T18:00:00.000Z",
    },
    {
      name: "Broad Feed",
      url: "https://example.com/rss",
      homepage: "https://example.com",
      language: "en",
      region: "Americas",
      weight: 1,
      enabled: true,
    },
  );

  expect(result).toBeNull();
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- tests/schema.test.ts tests/pipeline.test.ts`

Expected: FAIL because `经济` remains in `CATEGORIES`, economic text returns `经济`, and unrecognized text defaults to `国际`.

- [ ] **Step 3: Implement the five-category eligibility gate**

Set categories in `src/shared/categories.ts`:

```ts
export const CATEGORIES = ["科技", "财经", "政治", "国际", "体育"] as const;
```

In `src/pipeline/normalize.ts`, remove the `经济` keyword group, merge its terms into `财经`, expand multilingual/high-signal keywords as needed, and return `null` when no category scores:

```ts
export function inferCategory(text: string): NewsCategory | null {
  const words = new Set(extractKeywords(text));
  let bestCategory: NewsCategory | null = null;
  let bestScore = 0;

  for (const category of CATEGORIES) {
    const score = CATEGORY_KEYWORDS[category].filter((word) => words.has(word)).length;
    if (score > bestScore) {
      bestCategory = category;
      bestScore = score;
    }
  }

  return bestCategory;
}
```

Resolve category before constructing the normalized article:

```ts
const categoryHint = source.categoryHint ?? inferCategory(`${title} ${summary}`);
if (!categoryHint) return null;
```

Remove forced `categoryHint: "国际"` from Reuters World, BBC World, Al Jazeera and DW in `src/pipeline/sources.ts`. Keep narrow technology feed hints. Ensure Reddit mappings return one of the five categories and map `economics` to `财经`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- tests/schema.test.ts tests/pipeline.test.ts tests/socialSources.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the eligibility gate**

```bash
git add src/shared/categories.ts src/pipeline/normalize.ts src/pipeline/sources.ts src/pipeline/socialSources.ts tests/schema.test.ts tests/pipeline.test.ts tests/socialSources.test.ts
git commit -m "feat: filter news by focus category before ranking"
```

### Task 2: Coverage-Aware Global Top 10 Selection

**Files:**
- Create: `src/pipeline/selectTopClusters.ts`
- Create: `tests/selectTopClusters.test.ts`
- Modify: `src/pipeline/types.ts`
- Modify: `src/pipeline/cluster.ts`
- Modify: `src/pipeline/generateLatest.ts`

**Interfaces:**
- Produces: `NewsCluster.category: NewsCategory`
- Produces: `selectTopClusters(ranked: RankedCluster[], limit?: number): RankedCluster[]`
- Consumes: `rankClusters(...)` output already sorted descending by heat score

- [ ] **Step 1: Write failing selector tests**

Create `tests/selectTopClusters.test.ts` with small ranked-cluster fixtures and these assertions:

```ts
it("selects the strongest event from every available category before global fill", () => {
  const ranked = [
    cluster("tech-1", "科技", 100),
    cluster("tech-2", "科技", 99),
    cluster("finance-1", "财经", 80),
    cluster("politics-1", "政治", 70),
    cluster("world-1", "国际", 60),
    cluster("sport-1", "体育", 50),
  ];

  expect(selectTopClusters(ranked, 5).map((item) => item.id)).toEqual([
    "tech-1", "finance-1", "politics-1", "world-1", "sport-1",
  ]);
});

it("fills missing category positions from the global ranking", () => {
  const ranked = [
    cluster("tech-1", "科技", 100),
    cluster("tech-2", "科技", 90),
    cluster("finance-1", "财经", 80),
  ];

  expect(selectTopClusters(ranked, 3).map((item) => item.id)).toEqual([
    "tech-1", "finance-1", "tech-2",
  ]);
});
```

- [ ] **Step 2: Run the selector test and verify RED**

Run: `npm test -- tests/selectTopClusters.test.ts`

Expected: FAIL because `selectTopClusters` and cluster categories do not exist.

- [ ] **Step 3: Add deterministic cluster category resolution**

Add `category: NewsCategory` to `NewsCluster` in `src/pipeline/types.ts`. In `src/pipeline/cluster.ts`, initialize it from the article category and recompute it after a merge using summed source weight per category:

```ts
function resolveClusterCategory(articles: NormalizedArticle[]): NewsCategory {
  const weights = new Map<NewsCategory, number>();
  for (const article of articles) {
    weights.set(article.categoryHint, (weights.get(article.categoryHint) ?? 0) + article.sourceWeight);
  }
  return [...weights.entries()].sort((left, right) => right[1] - left[1])[0][0];
}
```

- [ ] **Step 4: Implement the coverage-aware selector**

Create `src/pipeline/selectTopClusters.ts`:

```ts
import { CATEGORIES } from "../shared/categories";
import type { RankedCluster } from "./types";

export function selectTopClusters(ranked: RankedCluster[], limit = 10): RankedCluster[] {
  const selected: RankedCluster[] = [];
  const used = new Set<string>();

  const representatives = CATEGORIES
    .map((category) => ranked.find((cluster) => cluster.category === category))
    .filter((cluster): cluster is RankedCluster => Boolean(cluster))
    .sort((left, right) => right.heat.score - left.heat.score);

  for (const cluster of [...representatives, ...ranked]) {
    if (selected.length >= limit) break;
    if (used.has(cluster.id)) continue;
    selected.push(cluster);
    used.add(cluster.id);
  }

  return selected;
}
```

Replace `rankClusters(clusters, now).slice(0, 10)` in `src/pipeline/generateLatest.ts` with:

```ts
const ranked = selectTopClusters(rankClusters(clusters, now), 10);
```

- [ ] **Step 5: Run selector and pipeline tests and verify GREEN**

Run: `npm test -- tests/selectTopClusters.test.ts tests/pipeline.test.ts tests/generateLatest.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit category coverage selection**

```bash
git add src/pipeline/selectTopClusters.ts tests/selectTopClusters.test.ts src/pipeline/types.ts src/pipeline/cluster.ts src/pipeline/generateLatest.ts
git commit -m "feat: prefer category coverage in global top ten"
```

### Task 3: Preserve Classification Through AI and Update Fixtures

**Files:**
- Modify: `src/pipeline/aiSummaries.ts`
- Modify: `src/pipeline/rank.ts`
- Modify: `src/shared/sampleData.ts`
- Modify: `data/latest.json`
- Modify: `README.md`
- Test: `tests/generateLatest.test.ts`

**Interfaces:**
- Consumes: `RankedCluster.category`
- Guarantees: `NewsEvent.category === RankedCluster.category`

- [ ] **Step 1: Write a failing AI category-preservation test**

Extend the configured-provider test in `tests/generateLatest.test.ts` so the input cluster is pre-classified as 科技 while the mocked AI response returns 政治, then assert:

```ts
expect(latest.events[0].category).toBe("科技");
```

- [ ] **Step 2: Run the provider test and verify RED**

Run: `npm test -- tests/generateLatest.test.ts`

Expected: FAIL because `buildEvent` currently trusts `summary.category`.

- [ ] **Step 3: Preserve the pre-ranked category**

In `src/pipeline/aiSummaries.ts`, change event construction to:

```ts
category: cluster.category,
```

Include `category: cluster.category` in each provider prompt payload and revise the instruction to say the supplied category must be retained. Remove `经济` from `IMPORTANT_CATEGORY_BONUS` in `src/pipeline/rank.ts`.

- [ ] **Step 4: Update samples, generated data and documentation**

Change all sample and checked-in latest-data events categorized as `经济` to `财经`. Update `README.md` to document the five categories and the exact processing order:

```text
24 小时候选采集 → 五类预筛选 → 事件聚类 → 热度排序 → 分类覆盖优先的全局 Top 10 → AI 中文摘要
```

- [ ] **Step 5: Run complete verification**

Run: `npm test`

Expected: all tests PASS.

Run: `npm run validate:data`

Expected: `Validated 10 events.`

Run: `npm run build`

Expected: TypeScript and Vite build complete successfully.

- [ ] **Step 6: Commit the completed behavior**

```bash
git add src/pipeline/aiSummaries.ts src/pipeline/rank.ts src/shared/sampleData.ts data/latest.json README.md tests/generateLatest.test.ts
git commit -m "feat: preserve preselected news categories"
```

### Task 4: Publish and Verify GitHub Pages

**Files:**
- No code changes expected

**Interfaces:**
- Consumes: all verified commits from Tasks 1-3
- Produces: updated `main` deployment at `https://pananq.github.io/topnews/`

- [ ] **Step 1: Push the implementation to main**

Run: `git push origin HEAD:main`

Expected: remote `main` advances to the final implementation commit.

- [ ] **Step 2: Verify the GitHub Actions run**

Run: `gh run list --repo pananq/topnews --limit 1`

Expected: the latest workflow completes with `success`.

- [ ] **Step 3: Verify deployed pages**

Run: `curl -I https://pananq.github.io/topnews/`

Run: `curl -I https://pananq.github.io/topnews/data/latest.json`

Expected: both return HTTP 200 and show deployment timestamps after the push.
