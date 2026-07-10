import Parser from "rss-parser";
import { SAMPLE_LATEST_NEWS } from "../shared/sampleData";
import { LatestNewsSchema, type LatestNews, type NewsEvent } from "../shared/schema";
import { clusterArticles } from "./cluster";
import { normalizeArticle } from "./normalize";
import { rankClusters } from "./rank";
import { NEWS_SOURCES } from "./sources";
import { isWithinWindow } from "./time";
import type { NewsSourceConfig, NormalizedArticle, RawFeedItem } from "./types";
import { summarizeClusters } from "./aiSummaries";

interface GenerateOptions {
  now?: Date;
  articles?: NormalizedArticle[];
  fetchFeeds?: boolean;
  apiKey?: string;
  model?: string;
}

export async function generateLatestNews(options: GenerateOptions = {}): Promise<LatestNews> {
  const now = options.now ?? new Date();
  const articles = options.articles ?? (options.fetchFeeds === false ? [] : await fetchRecentArticles(now));
  const clusters = clusterArticles(articles);
  const ranked = rankClusters(clusters, now).slice(0, 10);
  const generatedEvents = ranked.length > 0 ? await summarizeClusters(ranked, { apiKey: options.apiKey, model: options.model }) : [];
  const events = ensureTenEvents(generatedEvents);
  const latest: LatestNews = {
    generatedAt: now.toISOString(),
    windowHours: 24,
    timezone: "Asia/Shanghai",
    status: options.apiKey && generatedEvents.length > 0 ? "fresh" : "sample",
    events,
  };

  return LatestNewsSchema.parse(latest);
}

async function fetchRecentArticles(now: Date): Promise<NormalizedArticle[]> {
  const enabledSources = NEWS_SOURCES.filter((source) => source.enabled);
  const settled = await Promise.allSettled(enabledSources.map((source) => fetchSource(source, now)));

  return settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}

async function fetchSource(source: NewsSourceConfig, now: Date): Promise<NormalizedArticle[]> {
  const parser = new Parser();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "topnews-digest/0.1 (+https://github.com/pananq/topnews)",
      },
    });

    if (!response.ok) {
      throw new Error(`${source.name} returned HTTP ${response.status}`);
    }

    const feed = await parser.parseString(await response.text());

    return feed.items
      .map((item) => normalizeArticle(item as RawFeedItem, source))
      .filter((article): article is NormalizedArticle => Boolean(article))
      .filter((article) => isWithinWindow(article.publishedAt, now, 24));
  } catch (error) {
    console.warn(`Skipping ${source.name}: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function ensureTenEvents(events: NewsEvent[]): NewsEvent[] {
  const result = events.slice(0, 10);
  const usedTitles = new Set(result.map((event) => event.titleZh));

  for (const sampleEvent of SAMPLE_LATEST_NEWS.events) {
    if (result.length >= 10) {
      break;
    }

    if (usedTitles.has(sampleEvent.titleZh)) {
      continue;
    }

    result.push({
      ...sampleEvent,
      rank: result.length + 1,
    });
  }

  return result.map((event, index) => ({ ...event, rank: index + 1 }));
}
