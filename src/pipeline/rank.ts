import type { NewsCategory } from "../shared/categories";
import type { NewsCluster, RankedCluster } from "./types";

const IMPORTANT_CATEGORY_BONUS: Partial<Record<NewsCategory, number>> = {
  "科技": 4,
  "财经": 5,
  "政治": 6,
  "国际": 3,
  "体育": 2,
};

export function rankClusters(clusters: NewsCluster[], now: Date): RankedCluster[] {
  return clusters
    .map((cluster) => {
      const sourceNames = new Set(cluster.articles.map((article) => article.sourceName));
      const regions = new Set(cluster.articles.map((article) => article.sourceRegion));
      const sourceWeight = cluster.articles.reduce((sum, article) => sum + article.sourceWeight, 0);
      const freshness = averageFreshness(cluster, now);
      const categoryBonus = IMPORTANT_CATEGORY_BONUS[cluster.category] ?? 0;
      const rawScore = sourceNames.size * 18 + regions.size * 10 + sourceWeight * 12 + freshness * 16 + categoryBonus;
      const score = Math.max(1, Math.min(100, Math.round(rawScore)));

      return {
        ...cluster,
        heat: {
          score,
          sourceCount: sourceNames.size,
          regionCount: regions.size,
          reasonZh: `共有 ${sourceNames.size} 个来源、${regions.size} 个地区信号，且报道集中在过去 24 小时内。`,
        },
      };
    })
    .sort((left, right) => right.heat.score - left.heat.score);
}

function averageFreshness(cluster: NewsCluster, now: Date): number {
  const values = cluster.articles.map((article) => {
    const ageHours = (now.getTime() - Date.parse(article.publishedAt)) / 3_600_000;
    return Math.max(0, Math.min(1, 1 - ageHours / 24));
  });

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
