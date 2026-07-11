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

  it("filters out high-score Hacker News stories that fail the category eligibility gate", async () => {
    const articles = await fetchHackerNewsArticles(now, async (url) => {
      if (String(url).endsWith("/topstories.json")) {
        return jsonResponse([1002]);
      }

      return jsonResponse({
        id: 1002,
        type: "story",
        by: "hn-user",
        time: Math.floor(Date.parse("2026-07-08T20:00:00.000Z") / 1000),
        title: "World's oldest dog celebrates birthday",
        url: "https://example.com/oldest-dog",
        score: 9_000_000,
        descendants: 800_000,
      });
    });

    expect(articles).toEqual([]);
  });

  it("does not use Hacker News byline metadata as category evidence", async () => {
    const articles = await fetchHackerNewsArticles(now, async (url) => {
      if (String(url).endsWith("/topstories.json")) {
        return jsonResponse([1003]);
      }

      return jsonResponse({
        id: 1003,
        type: "story",
        by: "ai",
        time: Math.floor(Date.parse("2026-07-08T20:00:00.000Z") / 1000),
        title: "Neighborhood bakery opens weekend pop-up",
        url: "https://example.com/bakery",
        score: 9000,
        descendants: 700,
      });
    });

    expect(articles).toEqual([]);
  });

  it("rejects Hacker News stories with non-http URLs", async () => {
    const articles = await fetchHackerNewsArticles(now, async (url) => {
      if (String(url).endsWith("/topstories.json")) {
        return jsonResponse([1004]);
      }

      return jsonResponse({
        id: 1004,
        type: "story",
        by: "hn-user",
        time: Math.floor(Date.parse("2026-07-08T20:00:00.000Z") / 1000),
        title: "Open source AI database reaches major milestone",
        url: "javascript:alert(1)",
        score: 420,
        descendants: 86,
      });
    });

    expect(articles).toEqual([]);
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
                title: "Researchers publish new technology breakthrough",
                selftext: "A research team announced a software result discussed widely online.",
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
      title: "Researchers publish new technology breakthrough",
      url: "https://example.com/battery",
    });
    expect(articles[0].sourceWeight).toBeGreaterThan(1);
    expect(articles[0].summary).toContain("12000 upvotes");
  });

  it("rejects Reddit posts with non-http URLs", async () => {
    const articles = await fetchRedditArticles(
      now,
      async () =>
        jsonResponse({
          data: {
            children: [
              {
                data: {
                  id: "bad-url",
                  subreddit: "technology",
                  title: "Researchers publish new technology breakthrough",
                  selftext: "A software team announced a widely discussed result.",
                  url: "data:text/html,<script>alert(1)</script>",
                  permalink: "/r/technology/comments/bad-url/researchers_publish_new_technology_breakthrough/",
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

    expect(articles).toEqual([]);
  });

  it("filters out-of-focus posts from broad Reddit news feeds", async () => {
    const articles = await fetchRedditArticles(
      now,
      async (url) => {
        const subreddit = String(url).includes("/worldnews/") ? "worldnews" : "news";

        return jsonResponse({
          data: {
            children: [
              {
                data: {
                  id: `${subreddit}-weather`,
                  subreddit,
                  title: "Local weather service forecasts a rainy weekend",
                  selftext: "Residents should bring umbrellas to community events.",
                  url: "https://example.com/weather",
                  permalink: `/r/${subreddit}/comments/weather/local_weather/`,
                  created_utc: Math.floor(Date.parse("2026-07-08T19:00:00.000Z") / 1000),
                  score: 50,
                  num_comments: 8,
                  over_18: false,
                },
              },
            ],
          },
        });
      },
      ["worldnews", "news"],
    );

    expect(articles).toEqual([]);
  });

  it("rejects extremely popular Reddit posts that fail the category eligibility gate", async () => {
    const articles = await fetchRedditArticles(
      now,
      async () =>
        jsonResponse({
          data: {
            children: [
              {
                data: {
                  id: "popular-dog",
                  subreddit: "worldnews",
                  title: "World's oldest dog celebrates birthday",
                  selftext: "Millions shared photos from the birthday celebration.",
                  url: "https://example.com/oldest-dog",
                  permalink: "/r/worldnews/comments/popular-dog/oldest_dog/",
                  created_utc: Math.floor(Date.parse("2026-07-08T19:00:00.000Z") / 1000),
                  score: 9_000_000,
                  num_comments: 800_000,
                  over_18: false,
                },
              },
            ],
          },
        }),
      ["worldnews"],
    );

    expect(articles).toEqual([]);
  });

  it.each(["technology", "science", "unknownsubreddit"])(
    "filters off-topic Reddit posts from r/%s even when the subreddit looks category-specific",
    async (subreddit) => {
      const articles = await fetchRedditArticles(
        now,
        async () =>
          jsonResponse({
            data: {
              children: [
                {
                  data: {
                    id: `${subreddit}-dog`,
                    subreddit,
                    title: "World's oldest dog celebrates birthday",
                    selftext: "Millions shared photos from the birthday celebration.",
                    url: "https://example.com/oldest-dog",
                    permalink: `/r/${subreddit}/comments/popular-dog/oldest_dog/`,
                    created_utc: Math.floor(Date.parse("2026-07-08T19:00:00.000Z") / 1000),
                    score: 9_000_000,
                    num_comments: 800_000,
                    over_18: false,
                  },
                },
              ],
            },
          }),
        [subreddit],
      );

      expect(articles).toEqual([]);
    },
  );
});

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
