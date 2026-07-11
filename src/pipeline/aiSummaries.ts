import type { NewsCategory } from "../shared/categories";
import { CATEGORIES } from "../shared/categories";
import type { NewsEvent } from "../shared/schema";
import type { RankedCluster } from "./types";

interface SummaryOptions {
  provider?: AiProvider;
  openaiApiKey?: string;
  openaiModel?: string;
  deepseekApiKey?: string;
  deepseekModel?: string;
  fetchImpl?: typeof fetch;
}

export type AiProvider = "deepseek" | "openai";

interface AiEventSummary {
  titleZh: string;
  summaryZh: string;
  category: NewsCategory;
  regions: string[];
  reasonZh: string;
}

const EVENT_SUMMARY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    events: {
      type: "array",
      minItems: 1,
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          titleZh: { type: "string" },
          summaryZh: { type: "string" },
          category: { enum: [...CATEGORIES] },
          regions: { type: "array", minItems: 1, items: { type: "string" } },
          reasonZh: { type: "string" },
        },
        required: ["titleZh", "summaryZh", "category", "regions", "reasonZh"],
      },
    },
  },
  required: ["events"],
};

export async function summarizeClusters(clusters: RankedCluster[], options: SummaryOptions = {}): Promise<NewsEvent[]> {
  const provider = options.provider ?? "deepseek";
  const apiKey = provider === "deepseek" ? options.deepseekApiKey : options.openaiApiKey;

  if (!apiKey) {
    return fallbackSummaries(clusters);
  }

  try {
    const aiSummaries = provider === "deepseek" ? await requestDeepSeekSummaries(clusters, options) : await requestOpenAiSummaries(clusters, options);
    return clusters.map((cluster, index) => buildEvent(cluster, index + 1, aiSummaries[index] ?? fallbackSummary(cluster)));
  } catch (error) {
    console.warn(`AI summary failed, using deterministic fallback: ${error instanceof Error ? error.message : String(error)}`);
    return fallbackSummaries(clusters);
  }
}

function fallbackSummaries(clusters: RankedCluster[]): NewsEvent[] {
  return clusters.map((cluster, index) => buildEvent(cluster, index + 1, fallbackSummary(cluster)));
}

function fallbackSummary(cluster: RankedCluster): AiEventSummary {
  const first = cluster.articles[0];
  const regions = unique(cluster.articles.map((article) => article.sourceRegion));

  return {
    titleZh: first.title,
    summaryZh: `自动摘要：${first.summary || first.title}。该事件由 ${cluster.heat.sourceCount} 个来源报道，保留原文链接供继续阅读。`,
    category: first.categoryHint,
    regions: regions.length > 0 ? regions : ["全球"],
    reasonZh: cluster.heat.reasonZh,
  };
}

function buildEvent(cluster: RankedCluster, rank: number, summary: AiEventSummary): NewsEvent {
  const sources = uniqueBy(cluster.articles, (article) => article.url)
    .slice(0, 5)
    .map((article) => ({
      name: article.sourceName,
      url: article.url,
      language: article.language,
      publishedAt: article.publishedAt,
    }));

  return {
    rank,
    titleZh: summary.titleZh,
    summaryZh: summary.summaryZh,
    category: summary.category,
    regions: summary.regions.length > 0 ? summary.regions : ["全球"],
    heat: {
      ...cluster.heat,
      reasonZh: summary.reasonZh || cluster.heat.reasonZh,
    },
    sources,
  };
}

async function requestOpenAiSummaries(clusters: RankedCluster[], options: SummaryOptions): Promise<AiEventSummary[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${options.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: options.openaiModel ?? "gpt-5.5",
      input: [
        {
          role: "developer",
          content: "你是新闻编辑。只基于提供的来源标题和摘要，生成中文结构化新闻简报，不编造事实。",
        },
        {
          role: "user",
          content: JSON.stringify({
            instruction: `为每个新闻事件生成中文标题、2-3 句中文摘要、一个主分类、影响地区和热度依据。主分类只能从这些值中选择：${CATEGORIES.join("、")}。不要使用气候、安全、社会、娱乐等非目标分类。`,
            clusters: clusters.map((cluster) => ({
              representativeTitle: cluster.representativeTitle,
              heat: cluster.heat,
              articles: cluster.articles.slice(0, 5).map((article) => ({
                sourceName: article.sourceName,
                sourceRegion: article.sourceRegion,
                language: article.language,
                title: article.title,
                summary: article.summary,
                publishedAt: article.publishedAt,
              })),
            })),
          }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "global_news_events",
          strict: true,
          schema: EVENT_SUMMARY_SCHEMA,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API returned ${response.status}`);
  }

  const payload = (await response.json()) as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  const text = payload.output_text ?? payload.output?.flatMap((item) => item.content ?? []).find((content) => content.text)?.text;

  if (!text) {
    throw new Error("OpenAI response did not include output text");
  }

  const parsed = JSON.parse(text) as { events: AiEventSummary[] };
  return parsed.events;
}

async function requestDeepSeekSummaries(clusters: RankedCluster[], options: SummaryOptions): Promise<AiEventSummary[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${options.deepseekApiKey}`,
    },
    body: JSON.stringify({
      model: options.deepseekModel ?? "deepseek-v4-flash",
      messages: [
        {
          role: "system",
          content: "你是新闻编辑。只基于提供的来源标题和摘要生成中文简报。必须只输出合法 JSON，不要输出 Markdown，不要编造事实。",
        },
        {
          role: "user",
          content: JSON.stringify({
            instruction:
              `请输出 json，格式为 {"events":[{"titleZh":"...","summaryZh":"...","category":"${CATEGORIES.join("|")}","regions":["..."],"reasonZh":"..."}]}。为每个新闻事件生成中文标题、2-3 句中文摘要、一个主分类、影响地区和热度依据。主分类只能从这些值中选择：${CATEGORIES.join("、")}。不要使用气候、安全、社会、娱乐等非目标分类。`,
            clusters: clusters.map((cluster) => ({
              representativeTitle: cluster.representativeTitle,
              heat: cluster.heat,
              articles: cluster.articles.slice(0, 5).map((article) => ({
                sourceName: article.sourceName,
                sourceRegion: article.sourceRegion,
                language: article.language,
                title: article.title,
                summary: article.summary,
                publishedAt: article.publishedAt,
              })),
            })),
          }),
        },
      ],
      response_format: {
        type: "json_object",
      },
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API returned ${response.status}`);
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = payload.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error("DeepSeek response did not include message content");
  }

  const parsed = JSON.parse(text) as { events: AiEventSummary[] };
  return parsed.events;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function uniqueBy<T>(values: T[], keyFor: (value: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const value of values) {
    const key = keyFor(value);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(value);
    }
  }

  return result;
}
