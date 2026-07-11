import { describe, expect, it } from "vitest";
import { selectTopClusters } from "../src/pipeline/selectTopClusters";
import type { NewsCategory } from "../src/shared/categories";
import type { RankedCluster } from "../src/pipeline/types";

describe("selectTopClusters", () => {
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
      "tech-1",
      "finance-1",
      "politics-1",
      "world-1",
      "sport-1",
    ]);
  });

  it("fills missing category positions from the global ranking", () => {
    const ranked = [cluster("tech-1", "科技", 100), cluster("tech-2", "科技", 90), cluster("finance-1", "财经", 80)];

    expect(selectTopClusters(ranked, 3).map((item) => item.id)).toEqual(["tech-1", "finance-1", "tech-2"]);
  });
});

function cluster(id: string, category: NewsCategory, score: number): RankedCluster {
  return {
    id,
    category,
    articles: [],
    keywords: [],
    representativeTitle: id,
    heat: {
      score,
      sourceCount: 1,
      regionCount: 1,
      reasonZh: "test",
    },
  };
}
