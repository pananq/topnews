import type { LatestNews } from "./schema";

export const SAMPLE_LATEST_NEWS: LatestNews = {
  generatedAt: "2026-07-09T00:00:00.000Z",
  windowHours: 24,
  timezone: "Asia/Shanghai",
  status: "sample",
  events: [
    event(1, "政治", "多国领导人就新一轮安全协议展开磋商", "过去 24 小时内，多家国际媒体报道了围绕地区安全协议的密集外交活动。报道显示，各方仍在关键条款上谈判，后续进展可能影响区域关系。", ["欧洲", "美国"], 91),
    event(2, "科技", "主要科技公司发布新一代人工智能治理承诺", "来自英语和欧洲媒体的报道显示，数家大型科技企业公布了新的 AI 安全测试与透明度承诺。监管机构和行业组织正在评估这些承诺的约束力。", ["美国", "欧洲"], 88),
    event(3, "经济", "全球市场关注主要央行最新利率信号", "金融媒体集中报道了主要央行对通胀和利率路径的最新表态。投资者正在重新定价债券、股票和外汇市场风险。", ["全球"], 84),
    event(4, "国际", "联合国机构警告多地人道援助压力上升", "多家媒体援引国际组织消息称，冲突、粮食价格和极端天气正在推高部分地区的人道援助需求。援助机构呼吁增加资金和通行保障。", ["非洲", "中东"], 82),
    event(5, "安全", "关键海域航运安全事件引发国际关注", "国际新闻源报道，近期航运安全事件影响了部分商业航线。航运企业和政府机构正在评估风险并调整通行安排。", ["中东", "欧洲"], 80),
    event(6, "气候", "新一轮极端高温影响多个国家公共服务", "气象和公共媒体报道，多国在过去 24 小时内发布高温预警。电力、交通和医疗系统面临短期压力。", ["亚洲", "欧洲"], 77),
    event(7, "社会", "大型城市住房与生活成本议题升温", "多地媒体报道，住房负担和生活成本再次成为城市政策焦点。地方政府正在讨论租赁、补贴和供应侧措施。", ["北美", "欧洲"], 73),
    event(8, "体育", "国际赛事进入关键阶段，多支强队晋级", "体育媒体集中报道了重要国际赛事的淘汰赛结果。晋级队伍和明星选手表现成为社交媒体热点。", ["全球"], 68),
    event(9, "娱乐", "全球影视奖项公布入围名单", "娱乐媒体报道，新一届影视奖项入围名单公布，流媒体作品和国际合拍项目受到关注。业内人士认为名单反映了内容市场的全球化趋势。", ["美国", "亚洲"], 62),
    event(10, "科技", "网络安全机构披露新的企业软件漏洞风险", "多家科技媒体报道，安全研究人员披露了影响企业软件的新漏洞。厂商已发布缓解建议，企业 IT 团队正在排查受影响系统。", ["全球"], 60),
  ],
};

function event(rank: number, category: LatestNews["events"][number]["category"], titleZh: string, summaryZh: string, regions: string[], score: number): LatestNews["events"][number] {
  return {
    rank,
    titleZh,
    summaryZh,
    category,
    regions,
    heat: {
      score,
      sourceCount: Math.max(1, Math.round(score / 18)),
      regionCount: regions.length,
      reasonZh: "样例数据展示排名、来源数量和跨地区覆盖等热度信号。",
    },
    sources: [
      {
        name: "Reuters",
        url: `https://www.reuters.com/world/sample-${rank}`,
        language: "en",
        publishedAt: "2026-07-08T18:00:00.000Z",
      },
      {
        name: "BBC",
        url: `https://www.bbc.com/news/sample-${rank}`,
        language: "en",
        publishedAt: "2026-07-08T20:00:00.000Z",
      },
    ],
  };
}
