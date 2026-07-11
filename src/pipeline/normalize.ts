import { CATEGORIES, type NewsCategory } from "../shared/categories";
import type { NewsSourceConfig, NormalizedArticle, RawFeedItem } from "./types";

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "after",
  "with",
  "new",
  "major",
  "latest",
]);

const CATEGORY_KEYWORDS: Record<NewsCategory, string[]> = {
  "科技": ["ai", "artificial", "technology", "software", "cyber", "chip", "space"],
  "财经": ["market", "stock", "stocks", "investor", "earnings", "shares", "bond", "crypto", "finance", "bank"],
  "政治": ["election", "president", "minister", "senate", "parliament", "government", "diplomacy"],
  "经济": ["inflation", "rate", "trade", "economy", "gdp", "tariff", "supply", "central"],
  "国际": ["global", "united", "nations", "world", "foreign", "border"],
  "体育": ["match", "tournament", "cup", "league", "final", "player"],
};

const SYNONYMS = new Map([
  ["approves", "passes"],
  ["approved", "passes"],
  ["approve", "passes"],
  ["pass", "passes"],
  ["passed", "passes"],
  ["legislation", "bill"],
  ["law", "bill"],
  ["artificial", "ai"],
  ["intelligence", "ai"],
  ["markets", "market"],
  ["rises", "rally"],
  ["rise", "rally"],
]);

export function normalizeArticle(raw: RawFeedItem, source: NewsSourceConfig): NormalizedArticle | null {
  const title = cleanText(raw.title);
  const url = raw.link?.trim();
  const publishedAt = raw.isoDate ?? raw.pubDate;

  if (!title || !url || !publishedAt) {
    return null;
  }

  const summary = cleanText(raw.contentSnippet ?? raw.content ?? "");
  const keywords = extractKeywords(`${title} ${summary}`);

  return {
    id: `${source.name}:${url}`,
    sourceName: source.name,
    sourceUrl: source.homepage,
    sourceWeight: source.weight,
    sourceRegion: source.region,
    language: source.language,
    title,
    summary,
    url,
    publishedAt: new Date(publishedAt).toISOString(),
    categoryHint: source.categoryHint ?? inferCategory(`${title} ${summary}`),
    keywords,
  };
}

export function extractKeywords(text: string): string[] {
  const tokens = text
    .toLowerCase()
    .replace(/&amp;/g, " ")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ")
    .split(/\s+/)
    .map((token) => SYNONYMS.get(token) ?? token)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));

  return [...new Set(tokens)].slice(0, 18);
}

export function inferCategory(text: string): NewsCategory {
  const words = new Set(extractKeywords(text));
  let bestCategory: NewsCategory = "国际";
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

function cleanText(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}
