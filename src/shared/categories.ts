export const CATEGORIES = ["政治", "科技", "经济", "国际", "安全", "气候", "社会", "体育", "娱乐"] as const;

export const CATEGORY_FILTERS = ["全部", ...CATEGORIES] as const;

export type NewsCategory = (typeof CATEGORIES)[number];
