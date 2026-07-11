import { describe, expect, it } from "vitest";
import { clusterArticles } from "../src/pipeline/cluster";
import { inferCategory, normalizeArticle } from "../src/pipeline/normalize";
import { rankClusters } from "../src/pipeline/rank";
import { isWithinWindow } from "../src/pipeline/time";
import type { NormalizedArticle } from "../src/pipeline/types";

const now = new Date("2026-07-09T00:00:00.000Z");

describe("news pipeline", () => {
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

  it("filters articles to the past 24 hours", () => {
    expect(isWithinWindow("2026-07-08T12:00:00.000Z", now, 24)).toBe(true);
    expect(isWithinWindow("2026-07-07T23:59:59.000Z", now, 24)).toBe(false);
  });

  it("clusters similar reports into the same event", () => {
    const articles: NormalizedArticle[] = [
      article("Reuters", "en", "US Senate passes landmark AI safety bill", "Lawmakers passed a major artificial intelligence safety bill."),
      article("BBC", "en", "Senate approves major AI safety legislation", "The bill creates new rules for artificial intelligence systems."),
      article("NHK", "ja", "Japan issues tsunami warning after strong quake", "A powerful earthquake triggered coastal warnings."),
    ];

    const clusters = clusterArticles(articles);

    expect(clusters).toHaveLength(2);
    expect(clusters[0].articles).toHaveLength(2);
    expect(clusters[1].articles).toHaveLength(1);
  });

  it("ranks multi-source cross-region clusters above single-source clusters", () => {
    const clusters = clusterArticles([
      article("Reuters", "en", "Global markets rally after central bank signal", "Investors reacted to rate cut signals.", "Americas"),
      article("DW", "de", "Markets rise after central bank signal", "European investors also welcomed the signal.", "Europe"),
      article("Local Blog", "en", "Small city opens new library", "A local update.", "Americas", 0.2),
    ]);

    const ranked = rankClusters(clusters, now);

    expect(ranked[0].articles.length).toBe(2);
    expect(ranked[0].heat.score).toBeGreaterThan(ranked[1].heat.score);
  });
});

function article(
  sourceName: string,
  language: string,
  title: string,
  summary: string,
  region = "Global",
  weight = 1,
): NormalizedArticle {
  return {
    id: `${sourceName}-${title}`,
    sourceName,
    sourceUrl: "https://example.com",
    sourceWeight: weight,
    sourceRegion: region,
    language,
    title,
    summary,
    url: `https://example.com/${encodeURIComponent(title)}`,
    publishedAt: "2026-07-08T18:00:00.000Z",
    categoryHint: "国际",
    keywords: [],
  };
}
