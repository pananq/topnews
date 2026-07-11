import { z } from "zod";
import { CATEGORIES } from "./categories";
import { isHttpUrl } from "./url";

export const SourceSchema = z.object({
  name: z.string().min(1),
  url: z.string().url().refine(isHttpUrl, "Source URL must use http or https"),
  language: z.string().min(2),
  publishedAt: z.string().datetime(),
});

export const EventSchema = z.object({
  rank: z.number().int().min(1).max(10),
  titleZh: z.string().min(1),
  summaryZh: z.string().min(1),
  category: z.enum(CATEGORIES),
  regions: z.array(z.string().min(1)).min(1),
  heat: z.object({
    score: z.number().min(0).max(100),
    sourceCount: z.number().int().min(1),
    regionCount: z.number().int().min(1),
    reasonZh: z.string().min(1),
  }),
  sources: z.array(SourceSchema).min(1).max(5),
});

export const LatestNewsSchema = z.object({
  generatedAt: z.string().datetime(),
  windowHours: z.literal(24),
  timezone: z.literal("Asia/Shanghai"),
  status: z.enum(["fresh", "partial", "stale", "sample"]),
  events: z.array(EventSchema).length(10),
});

export type NewsSource = z.infer<typeof SourceSchema>;
export type NewsEvent = z.infer<typeof EventSchema>;
export type LatestNews = z.infer<typeof LatestNewsSchema>;
