import { z } from "zod";
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

const CHINESE_ORDINALS = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"] as const;
const REGION_LABELS_ZH: Record<string, string> = {
  "Global": "全球",
  "Europe": "欧洲",
  "Middle East": "中东",
  "Asia": "亚洲",
  "Americas": "美洲",
};

interface AiEventSummary {
  clusterId: string;
  titleZh: string;
  summaryZh: string;
  regions: string[];
  reasonZh: string;
}

export interface SummaryResult {
  events: NewsEvent[];
  status: "fresh" | "sample";
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
          clusterId: { type: "string" },
          titleZh: { type: "string" },
          summaryZh: { type: "string" },
          regions: { type: "array", minItems: 1, items: { type: "string" } },
          reasonZh: { type: "string" },
        },
        required: ["clusterId", "titleZh", "summaryZh", "regions", "reasonZh"],
      },
    },
  },
  required: ["events"],
};

const AiEventSummarySchema = z
  .object({
    clusterId: z.string().min(1),
    titleZh: z.string().min(1),
    summaryZh: z.string().min(1),
    regions: z.array(z.string().min(1)).min(1),
    reasonZh: z.string(),
  })
  .strict();

const AiSummaryResponseSchema = z
  .object({
    events: z.array(AiEventSummarySchema).min(1).max(10),
  })
  .strict();

export async function summarizeClusters(clusters: RankedCluster[], options: SummaryOptions = {}): Promise<SummaryResult> {
  const provider = options.provider ?? "deepseek";
  const apiKey = provider === "deepseek" ? options.deepseekApiKey : options.openaiApiKey;

  if (!apiKey) {
    return { events: fallbackSummaries(clusters), status: "sample" };
  }

  try {
    const aiSummaries = provider === "deepseek" ? await requestDeepSeekSummaries(clusters, options) : await requestOpenAiSummaries(clusters, options);
    const orderedSummaries = orderSummariesByCluster(aiSummaries, clusters);

    return {
      events: clusters.map((cluster, index) => buildEvent(cluster, index + 1, orderedSummaries[index])),
      status: "fresh",
    };
  } catch (error) {
    console.warn(`AI summary failed, using deterministic fallback: ${error instanceof Error ? error.message : String(error)}`);
    return { events: fallbackSummaries(clusters), status: "sample" };
  }
}

function fallbackSummaries(clusters: RankedCluster[]): NewsEvent[] {
  return clusters.map((cluster, index) => buildEvent(cluster, index + 1, fallbackSummary(cluster, index)));
}

function fallbackSummary(cluster: RankedCluster, index: number): AiEventSummary {
  const regions = unique(cluster.articles.map((article) => localizeRegion(article.sourceRegion)));

  return {
    clusterId: cluster.id,
    titleZh: `第${CHINESE_ORDINALS[index] ?? "十"}条${cluster.category}要闻`,
    summaryZh: "自动摘要：该事件已有来源报道。当前保留来源链接供继续阅读。",
    regions: regions.length > 0 ? regions : ["全球"],
    reasonZh: cluster.heat.reasonZh,
  };
}

function localizeRegion(region: string): string {
  return REGION_LABELS_ZH[region] ?? region;
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
    category: cluster.category,
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
            instruction:
              "为每个新闻事件生成简体中文标题、2-3 句简体中文摘要、简体中文影响地区和简体中文热度依据。titleZh、summaryZh、regions、reasonZh 全部必须使用简体中文。每个输出事件必须原样包含输入的 clusterId。不要输出分类字段，不要根据内容改分类，不要编造事实。",
            clusters: clusters.map((cluster) => ({
              clusterId: cluster.id,
              representativeTitle: cluster.representativeTitle,
              category: cluster.category,
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

  return parseAiSummaryResponse(JSON.parse(text)).events;
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
              '请输出 json，格式为 {"events":[{"clusterId":"输入的 clusterId","titleZh":"...","summaryZh":"...","regions":["..."],"reasonZh":"..."}]}。为每个新闻事件生成简体中文标题、2-3 句简体中文摘要、简体中文影响地区和简体中文热度依据。titleZh、summaryZh、regions、reasonZh 全部必须使用简体中文。每个输出事件必须原样包含输入的 clusterId。不要输出分类字段，不要根据内容改分类，不要编造事实。',
            clusters: clusters.map((cluster) => ({
              clusterId: cluster.id,
              representativeTitle: cluster.representativeTitle,
              category: cluster.category,
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

  return parseAiSummaryResponse(JSON.parse(text)).events;
}

function parseAiSummaryResponse(value: unknown): { events: AiEventSummary[] } {
  return AiSummaryResponseSchema.parse(value);
}

function orderSummariesByCluster(aiSummaries: AiEventSummary[], clusters: RankedCluster[]): AiEventSummary[] {
  if (aiSummaries.length !== clusters.length) {
    throw new Error(`AI returned ${aiSummaries.length} events for ${clusters.length} clusters`);
  }

  const expectedIds = new Set(clusters.map((cluster) => cluster.id));
  const byClusterId = new Map<string, AiEventSummary>();

  for (const summary of aiSummaries) {
    if (!expectedIds.has(summary.clusterId)) {
      throw new Error(`AI returned unknown clusterId: ${summary.clusterId}`);
    }

    if (!isChineseFacingSummary(summary)) {
      throw new Error(`AI returned non-Chinese summary for clusterId: ${summary.clusterId}`);
    }

    if (byClusterId.has(summary.clusterId)) {
      throw new Error(`AI returned duplicate clusterId: ${summary.clusterId}`);
    }

    byClusterId.set(summary.clusterId, summary);
  }

  return clusters.map((cluster) => {
    const summary = byClusterId.get(cluster.id);

    if (!summary) {
      throw new Error(`AI did not return clusterId: ${cluster.id}`);
    }

    return summary;
  });
}

function isChineseFacingSummary(summary: AiEventSummary): boolean {
  return [summary.titleZh, summary.summaryZh, summary.reasonZh].every(isChineseFacingText) && summary.regions.every(isSafeChineseRegion);
}

function isChineseFacingText(value: string): boolean {
  const cjkCount = [...value.matchAll(/[\u4e00-\u9fff]/g)].length;
  const latinCount = [...value.matchAll(/[A-Za-z]/g)].length;
  const denominator = cjkCount + latinCount;

  return cjkCount >= 4 && (denominator === 0 || cjkCount / denominator >= 0.35);
}

function isSafeChineseRegion(value: string): boolean {
  return !/[<>]/.test(value) && /[\u4e00-\u9fff]/.test(value);
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
