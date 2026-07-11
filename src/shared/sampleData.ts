import type { LatestNews } from "./schema";

export const SAMPLE_LATEST_NEWS: LatestNews = {
  generatedAt: "2026-07-09T00:00:00.000Z",
  windowHours: 24,
  timezone: "Asia/Shanghai",
  status: "sample",
  events: [
    event(1, "科技", "主要科技公司发布新一代人工智能治理承诺", "来自英语和欧洲媒体的报道显示，数家大型科技企业公布了新的 AI 安全测试与透明度承诺。监管机构和行业组织正在评估这些承诺的约束力。", ["美国", "欧洲"], 91),
    event(2, "财经", "全球股市关注大型科技企业财报与 AI 投资回报", "财经媒体集中报道，大型科技公司的资本开支、云业务和 AI 收入正在影响市场情绪。投资者关注利润率和未来指引。", ["美国", "全球"], 88),
    event(3, "政治", "多国领导人就新一轮贸易与外交议程展开磋商", "过去 24 小时内，多家国际媒体报道了围绕贸易、关税和外交议程的密集磋商。各方仍在关键条款上谈判，后续进展可能影响区域关系。", ["欧洲", "美国"], 85),
    event(4, "经济", "全球市场关注主要央行最新利率信号", "金融媒体集中报道了主要央行对通胀和利率路径的最新表态。投资者正在重新定价债券、股票和外汇市场风险。", ["全球"], 83),
    event(5, "国际", "国际组织和多国政府推动新一轮多边协调", "多家媒体报道，国际组织和主要经济体正在推动跨地区议题协调。议程涉及贸易、技术规则和地区合作。", ["亚洲", "欧洲"], 80),
    event(6, "体育", "国际赛事进入关键阶段，多支强队晋级", "体育媒体集中报道了重要国际赛事的淘汰赛结果。晋级队伍和明星选手表现成为社交媒体热点。", ["全球"], 76),
    event(7, "科技", "开源社区热议新一代开发工具与模型部署", "Hacker News 和科技媒体关注新的开发工具、模型推理框架和云端部署方案。开发者讨论集中在成本、性能和可维护性。", ["全球"], 73),
    event(8, "财经", "加密资产与成长股同步波动引发交易员关注", "市场讨论显示，风险资产在宏观数据和资金流影响下波动加大。交易员关注流动性变化、ETF 资金流和监管信号。", ["美国", "全球"], 70),
    event(9, "经济", "主要经济体公布新一批制造业与消费数据", "经济数据成为市场和政策讨论焦点。分析师关注消费韧性、制造业订单和就业市场变化。", ["全球"], 66),
    event(10, "国际", "区域峰会释放新的跨境合作信号", "国际媒体报道，一场区域峰会释放了加强经贸和科技合作的信号。与会方预计将在后续会议中推进更多细节。", ["亚洲", "欧洲"], 62),
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
