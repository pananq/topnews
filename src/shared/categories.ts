export const CATEGORIES = ["科技", "财经", "政治", "国际", "体育"] as const;

export const CATEGORY_FILTERS = ["全部", ...CATEGORIES] as const;

export type NewsCategory = (typeof CATEGORIES)[number];
