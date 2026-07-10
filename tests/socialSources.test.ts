import { describe, expect, it } from "vitest";
import { fetchHackerNewsArticles, fetchRedditArticles } from "../src/pipeline/socialSources";

const now = new Date("2026-07-09T00:00:00.000Z");

describe("social sources", () => {
  it("normalizes Hacker News top stories into pipeline articles", async () => {
    const calls: string[] = [];
    const articles = await fetchHackerNewsArticles(now, async (url) => {
      calls.push(String(url));

      if (String(url).endsWith("/topstories.json")) {
        return jsonResponse([1001]);
      }

      return jsonResponse({
        id: 1001,
        type: "story",
        by: "hn-user",
        time: Math.floor(Date.parse("2026-07-08T20:00:00.000Z") / 1000),
        title: "Open source AI database reaches major milestone",
        url: "https://example.com/ai-database",
        score: 420,
        descendants: 86,
      });
    });

    expect(calls).toHaveLength(2);
    expect(articles).toHaveLength(1);
    expect(articles[0]).toMatchObject({
      sourceName: "Hacker News",
      sourceKind: "hacker_news",
      categoryHint: "科技",
      title: "Open source AI database reaches major milestone",
      url: "https://example.com/ai-database",
    });
    expect(articles[0].sourceWeight).toBeGreaterThan(1);
    expect(articles[0].summary).toContain("420 points");
  });

  it("normalizes Reddit daily top posts into pipeline articles", async () => {
    const articles = await fetchRedditArticles(now, async () =>
      jsonResponse({
        data: {
          children: [
            {
              data: {
                id: "abc123",
                subreddit: "technology",
                title: "Researchers publish new battery breakthrough",
                selftext: "A research team announced a battery result discussed widely online.",
                url: "https://example.com/battery",
                permalink: "/r/technology/comments/abc123/researchers_publish_new_battery_breakthrough/",
                created_utc: Math.floor(Date.parse("2026-07-08T19:00:00.000Z") / 1000),
                score: 12000,
                num_comments: 1400,
                over_18: false,
              },
            },
          ],
        },
      }),
      ["technology"],
    );

    expect(articles).toHaveLength(1);
    expect(articles[0]).toMatchObject({
      sourceName: "Reddit r/technology",
      sourceKind: "reddit",
      categoryHint: "科技",
      title: "Researchers publish new battery breakthrough",
      url: "https://example.com/battery",
    });
    expect(articles[0].sourceWeight).toBeGreaterThan(1);
    expect(articles[0].summary).toContain("12000 upvotes");
  });
});

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
