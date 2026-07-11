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

interface CategoryEvidence {
  strongWords: readonly string[];
  combinations: readonly (readonly string[])[];
}

const CATEGORY_EVIDENCE: Record<NewsCategory, CategoryEvidence> = {
  "科技": {
    strongWords: [
      "ai",
      "technology",
      "software",
      "cyber",
      "chip",
      "semiconductor",
      "technologie",
      "tecnologia",
      "kunstliche",
      "intelligenz",
      "人工智能",
      "半导体",
      "半導体",
      "科技",
      "技術",
      "技术",
    ],
    combinations: [["artificial", "intelligence"]],
  },
  "财经": {
    strongWords: [
      "market",
      "stock",
      "stocks",
      "investor",
      "earnings",
      "shares",
      "bond",
      "crypto",
      "finance",
      "inflation",
      "trade",
      "economy",
      "economic",
      "macroeconomic",
      "banking",
      "gdp",
      "tariff",
      "banque",
      "taux",
      "economie",
      "marche",
      "mercado",
      "banco",
      "zentralbank",
      "wirtschaft",
      "央行",
      "降息",
      "股市",
      "经济",
      "經濟",
      "市場",
      "銀行",
    ],
    combinations: [
      ["central", "bank"],
      ["banque", "centrale"],
      ["banco", "central"],
      ["interest", "rate"],
      ["interest", "rates"],
      ["supply", "chain"],
    ],
  },
  "政治": {
    strongWords: [
      "election",
      "president",
      "senate",
      "parliament",
      "government",
      "diplomacy",
      "diplomatic",
      "gouvernement",
      "eleccion",
      "gobierno",
      "bundestag",
      "regierung",
      "政府",
      "总统",
      "總統",
      "首相",
      "选举",
      "選舉",
    ],
    combinations: [
      ["prime", "minister"],
      ["foreign", "minister"],
    ],
  },
  "国际": {
    strongWords: [
      "geopolitical",
      "ceasefire",
      "invasion",
      "refugee",
      "embassy",
      "cessez",
      "feu",
      "onu",
      "fluchtling",
      "联合国",
      "聯合國",
      "外交",
      "停火",
      "難民",
      "难民",
    ],
    combinations: [
      ["united", "nations"],
      ["security", "council"],
      ["border", "conflict"],
      ["israel", "iran"],
      ["nuclear", "facilities"],
    ],
  },
  "体育": {
    strongWords: [
      "match",
      "tournament",
      "league",
      "championship",
      "olympic",
      "olympics",
      "sport",
      "football",
      "futbol",
      "bundesliga",
      "奥运",
      "奧運",
      "世界杯",
      "联赛",
      "聯賽",
    ],
    combinations: [
      ["world", "cup"],
      ["cup", "final"],
    ],
  },
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
  const text = `${title} ${summary}`;
  const categoryHint = source.categoryHint ?? inferCategory(text);

  if (!categoryHint) {
    return null;
  }

  const keywords = extractKeywords(text);

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
    categoryHint,
    keywords,
  };
}

export function extractKeywords(text: string): string[] {
  return clusteringTokens(text).slice(0, 18);
}

export function inferCategory(text: string): NewsCategory | null {
  const tokens = classificationTokens(text);
  const words = new Set(tokens);
  const normalizedText = normalizeForSearch(text);
  let bestCategory: NewsCategory | null = null;
  let bestScore = 0;

  for (const category of CATEGORIES) {
    const evidence = CATEGORY_EVIDENCE[category];
    const strongWordScore = evidence.strongWords.filter((word) => words.has(word) || containsCjkEvidence(normalizedText, word)).length;
    const combinationScore = evidence.combinations.filter((combination) => containsAdjacentPhrase(tokens, combination)).length;
    const score = strongWordScore + combinationScore;

    if (score > bestScore) {
      bestCategory = category;
      bestScore = score;
    }
  }

  return bestCategory;
}

function classificationTokens(text: string): string[] {
  return rawTokens(text).map((token) => {
    if (token === "artificial" || token === "intelligence") {
      return token;
    }

    return SYNONYMS.get(token) ?? token;
  });
}

function clusteringTokens(text: string): string[] {
  const tokens = rawTokens(text)
    .map((token) => SYNONYMS.get(token) ?? token)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));

  return [...new Set(tokens)];
}

function rawTokens(text: string): string[] {
  return normalizeForSearch(text)
    .replace(/&amp;/g, " ")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function containsCjkEvidence(text: string, evidence: string): boolean {
  return /[\u4e00-\u9fff]/.test(evidence) && text.includes(evidence);
}

function containsAdjacentPhrase(tokens: readonly string[], phrase: readonly string[]): boolean {
  return tokens.some((_, start) => phrase.every((word, offset) => tokens[start + offset] === word));
}

function cleanText(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}
