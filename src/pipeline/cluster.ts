import { extractKeywords } from "./normalize";
import type { NewsCluster, NormalizedArticle } from "./types";

export function clusterArticles(articles: NormalizedArticle[]): NewsCluster[] {
  const clusters: NewsCluster[] = [];

  for (const article of articles) {
    const keywords = article.keywords.length > 0 ? article.keywords : extractKeywords(`${article.title} ${article.summary}`);
    const candidate = clusters.find((cluster) => articleSimilarity(keywords, article, cluster) >= 0.3);

    if (candidate) {
      candidate.articles.push({ ...article, keywords });
      candidate.keywords = mergeKeywords(candidate.keywords, keywords);
      continue;
    }

    clusters.push({
      id: article.id,
      articles: [{ ...article, keywords }],
      keywords,
      representativeTitle: article.title,
    });
  }

  return clusters.sort((left, right) => right.articles.length - left.articles.length);
}

function articleSimilarity(keywords: string[], article: NormalizedArticle, cluster: NewsCluster): number {
  const keywordScore = jaccard(keywords, cluster.keywords);
  const titleScore = jaccard(extractKeywords(article.title), extractKeywords(cluster.representativeTitle));
  const sourceBonus = cluster.articles.some((clusterArticle) => clusterArticle.sourceName !== article.sourceName) ? 0.08 : 0;

  return Math.max(keywordScore, titleScore) + sourceBonus;
}

function jaccard(left: string[], right: string[]): number {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const intersection = [...leftSet].filter((token) => rightSet.has(token)).length;
  const union = new Set([...leftSet, ...rightSet]).size;

  return union === 0 ? 0 : intersection / union;
}

function mergeKeywords(left: string[], right: string[]): string[] {
  return [...new Set([...left, ...right])].slice(0, 24);
}
