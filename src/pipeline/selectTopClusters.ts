import { CATEGORIES } from "../shared/categories";
import type { RankedCluster } from "./types";

export function selectTopClusters(ranked: RankedCluster[], limit = 10): RankedCluster[] {
  const selected: RankedCluster[] = [];
  const used = new Set<string>();

  const representatives = CATEGORIES.map((category) => ranked.find((cluster) => cluster.category === category))
    .filter((cluster): cluster is RankedCluster => Boolean(cluster))
    .sort((left, right) => right.heat.score - left.heat.score);

  for (const cluster of [...representatives, ...ranked]) {
    if (selected.length >= limit) {
      break;
    }

    if (used.has(cluster.id)) {
      continue;
    }

    selected.push(cluster);
    used.add(cluster.id);
  }

  return selected;
}
