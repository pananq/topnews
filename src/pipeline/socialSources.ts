import type { NewsCategory } from "../shared/categories";
import { extractKeywords, inferCategory } from "./normalize";
import { isWithinWindow } from "./time";
import type { NormalizedArticle } from "./types";

const HN_TOP_STORIES_URL = "https://hacker-news.firebaseio.com/v0/topstories.json";
const HN_ITEM_URL = "https://hacker-news.firebaseio.com/v0/item";
const REDDIT_BASE_URL = "https://www.reddit.com/r";
const DEFAULT_REDDIT_SUBREDDITS = ["worldnews", "news", "technology", "science", "business", "finance", "economics", "sports"] as const;
const REQUEST_TIMEOUT_MS = 12_000;

interface HackerNewsItem {
  id: number;
  type?: string;
  by?: string;
  time?: number;
  title?: string;
  url?: string;
  score?: number;
  descendants?: number;
}

interface RedditListing {
  data?: {
    children?: Array<{
      data?: RedditPost;
    }>;
  };
}

interface RedditPost {
  id?: string;
  subreddit?: string;
  title?: string;
  selftext?: string;
  url?: string;
  permalink?: string;
  created_utc?: number;
  score?: number;
  num_comments?: number;
  over_18?: boolean;
}

export async function fetchSocialArticles(now: Date, fetchImpl: typeof fetch = fetch): Promise<NormalizedArticle[]> {
  const settled = await Promise.allSettled([fetchHackerNewsArticles(now, fetchImpl), fetchRedditArticles(now, fetchImpl)]);

  return settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}

export async function fetchHackerNewsArticles(now: Date, fetchImpl: typeof fetch = fetch, limit = 80): Promise<NormalizedArticle[]> {
  try {
    const topStories = (await fetchJson<number[]>(HN_TOP_STORIES_URL, fetchImpl)) ?? [];
    const itemIds = topStories.slice(0, limit);
    const settled = await Promise.allSettled(itemIds.map((id) => fetchJson<HackerNewsItem>(`${HN_ITEM_URL}/${id}.json`, fetchImpl)));

    return settled
      .flatMap((result) => (result.status === "fulfilled" && result.value ? [result.value] : []))
      .map((item) => normalizeHackerNewsItem(item))
      .filter((article): article is NormalizedArticle => Boolean(article))
      .filter((article) => isWithinWindow(article.publishedAt, now, 24));
  } catch (error) {
    console.warn(`Skipping Hacker News: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

export async function fetchRedditArticles(
  now: Date,
  fetchImpl: typeof fetch = fetch,
  subreddits: readonly string[] = DEFAULT_REDDIT_SUBREDDITS,
): Promise<NormalizedArticle[]> {
  const settled = await Promise.allSettled(
    subreddits.map((subreddit) => fetchJson<RedditListing>(`${REDDIT_BASE_URL}/${subreddit}/top.json?t=day&limit=25`, fetchImpl)),
  );

  return settled
    .flatMap((result) => (result.status === "fulfilled" ? (result.value?.data?.children ?? []) : []))
    .map((child) => normalizeRedditPost(child.data))
    .filter((article): article is NormalizedArticle => Boolean(article))
    .filter((article) => isWithinWindow(article.publishedAt, now, 24));
}

function normalizeHackerNewsItem(item: HackerNewsItem): NormalizedArticle | null {
  if (item.type !== "story" || !item.title || !item.time) {
    return null;
  }

  const score = item.score ?? 0;
  const comments = item.descendants ?? 0;
  const url = item.url ?? `https://news.ycombinator.com/item?id=${item.id}`;
  const summary = `${score} points, ${comments} comments on Hacker News. ${item.by ? `Posted by ${item.by}.` : ""}`.trim();

  return {
    id: `hn:${item.id}`,
    sourceName: "Hacker News",
    sourceUrl: "https://news.ycombinator.com",
    sourceKind: "hacker_news",
    sourceWeight: socialWeight(score, comments, 0.9),
    sourceRegion: "Global",
    language: "en",
    title: item.title,
    summary,
    url,
    publishedAt: new Date(item.time * 1000).toISOString(),
    categoryHint: "科技",
    keywords: extractKeywords(`${item.title} ${summary}`),
    socialScore: score,
    commentCount: comments,
  };
}

function normalizeRedditPost(post: RedditPost | undefined): NormalizedArticle | null {
  if (!post?.id || !post.title || !post.created_utc || post.over_18) {
    return null;
  }

  const subreddit = post.subreddit ?? "unknown";
  const score = post.score ?? 0;
  const comments = post.num_comments ?? 0;
  const url = post.url ?? `https://www.reddit.com${post.permalink ?? ""}`;
  const summaryText = post.selftext?.trim();
  const summary = `${score} upvotes, ${comments} comments on r/${subreddit}. ${summaryText ? summaryText.slice(0, 260) : ""}`.trim();
  const categoryHint = ["worldnews", "news"].includes(subreddit.toLowerCase()) ? inferCategory(`${post.title} ${summary}`) : redditCategory(subreddit);

  if (!categoryHint) {
    return null;
  }

  return {
    id: `reddit:${subreddit}:${post.id}`,
    sourceName: `Reddit r/${subreddit}`,
    sourceUrl: `https://www.reddit.com/r/${subreddit}`,
    sourceKind: "reddit",
    sourceWeight: socialWeight(score, comments, 0.65),
    sourceRegion: "Global",
    language: "en",
    title: post.title,
    summary,
    url,
    publishedAt: new Date(post.created_utc * 1000).toISOString(),
    categoryHint,
    keywords: extractKeywords(`${post.title} ${summary}`),
    socialScore: score,
    commentCount: comments,
  };
}

async function fetchJson<T>(url: string, fetchImpl: typeof fetch): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
        "User-Agent": "topnews-digest/0.1 (+https://github.com/pananq/topnews)",
      },
    });

    if (!response.ok) {
      throw new Error(`${url} returned HTTP ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function socialWeight(score: number, comments: number, base: number): number {
  return Math.min(2.4, base + Math.log10(Math.max(1, score) + Math.max(0, comments) * 2) / 3);
}

function redditCategory(subreddit: string): NewsCategory {
  const normalized = subreddit.toLowerCase();

  if (["technology", "science", "artificial"].includes(normalized)) {
    return "科技";
  }

  if (["business", "finance", "economics"].includes(normalized)) {
    return "财经";
  }

  if (["sports"].includes(normalized)) {
    return "体育";
  }

  return "国际";
}
