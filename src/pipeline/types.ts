import type { NewsCategory } from "../shared/categories";

export type SourceKind = "news_rss" | "hacker_news" | "reddit";

export interface NewsSourceConfig {
  name: string;
  url: string;
  homepage: string;
  language: string;
  region: string;
  weight: number;
  categoryHint?: NewsCategory;
  enabled: boolean;
}

export interface RawFeedItem {
  title?: string;
  link?: string;
  contentSnippet?: string;
  content?: string;
  isoDate?: string;
  pubDate?: string;
}

export interface NormalizedArticle {
  id: string;
  sourceName: string;
  sourceUrl: string;
  sourceWeight: number;
  sourceRegion: string;
  sourceKind?: SourceKind;
  language: string;
  title: string;
  summary: string;
  url: string;
  publishedAt: string;
  categoryHint: NewsCategory;
  keywords: string[];
  socialScore?: number;
  commentCount?: number;
}

export interface NewsCluster {
  id: string;
  articles: NormalizedArticle[];
  keywords: string[];
  representativeTitle: string;
}

export interface RankedCluster extends NewsCluster {
  heat: {
    score: number;
    sourceCount: number;
    regionCount: number;
    reasonZh: string;
  };
}
