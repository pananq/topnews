import latest from "../data/latest.json";
import { CATEGORY_FILTERS, CATEGORIES, type NewsCategory } from "./shared/categories";
import { LatestNewsSchema, type LatestNews, type NewsEvent } from "./shared/schema";
import "./styles.css";

type Status = LatestNews["status"];
type CategoryFilter = "全部" | NewsCategory;

const statusLabels: Record<Status, string> = {
  fresh: "数据已更新",
  partial: "部分来源更新",
  stale: "使用上一版数据",
  sample: "样例数据",
};

let currentData: LatestNews = LatestNewsSchema.parse(latest);
let activeCategory: CategoryFilter = "全部";

export function renderStatusLabel(status: Status): string {
  return statusLabels[status];
}

export function getCategoryCounts(events: Pick<NewsEvent, "category">[]): Record<NewsCategory, number> {
  return Object.fromEntries(CATEGORIES.map((category) => [category, events.filter((event) => event.category === category).length])) as Record<
    NewsCategory,
    number
  >;
}

async function boot(): Promise<void> {
  const app = document.getElementById("app");

  if (!app) {
    return;
  }

  currentData = await loadLatestNews();
  render(app);
}

async function loadLatestNews(): Promise<LatestNews> {
  try {
    const response = await fetch("./data/latest.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return LatestNewsSchema.parse(await response.json());
  } catch (error) {
    console.warn(`Using bundled sample data: ${error instanceof Error ? error.message : String(error)}`);
    return LatestNewsSchema.parse(latest);
  }
}

function render(app: HTMLElement): void {
  const visibleEvents = activeCategory === "全部" ? currentData.events : currentData.events.filter((event) => event.category === activeCategory);
  const counts = getCategoryCounts(currentData.events);

  app.innerHTML = `
    <header class="topbar">
      <div>
        <p class="kicker">GLOBAL NEWS DIGEST</p>
        <h1>全球十大新闻</h1>
      </div>
      <div class="status-panel">
        <span class="status-dot status-${currentData.status}"></span>
        <strong>${renderStatusLabel(currentData.status)}</strong>
        <span>${formatGeneratedAt(currentData.generatedAt)}</span>
        <span>过去 ${currentData.windowHours} 小时</span>
      </div>
    </header>
    <nav class="filters" aria-label="新闻分类">
      ${CATEGORY_FILTERS.map((category) => renderFilter(category)).join("")}
    </nav>
    <main class="layout">
      <section class="news-list" aria-label="十大新闻事件">
        ${visibleEvents.map(renderEvent).join("")}
      </section>
      <aside class="sidebar" aria-label="今日概览">
        <section class="overview-block">
          <h2>分类分布</h2>
          <div class="distribution">
            ${CATEGORIES.map((category) => renderDistributionBar(category, counts[category], currentData.events.length)).join("")}
          </div>
        </section>
        <section class="overview-block">
          <h2>来源概览</h2>
          <p class="metric">${new Set(currentData.events.flatMap((event) => event.sources.map((source) => source.name))).size}</p>
          <span>个媒体来源</span>
          <p class="metric">${currentData.events.reduce((sum, event) => sum + event.sources.length, 0)}</p>
          <span>条原文链接</span>
        </section>
      </aside>
    </main>
  `;

  app.querySelectorAll<HTMLButtonElement>("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      activeCategory = button.dataset.category as CategoryFilter;
      render(app);
    });
  });
}

function renderFilter(category: CategoryFilter): string {
  const selected = activeCategory === category;
  return `<button class="filter ${selected ? "is-active" : ""}" data-category="${category}" aria-pressed="${selected}">${category}</button>`;
}

export function renderEvent(event: NewsEvent): string {
  return `
    <article class="event">
      <div class="rank">${event.rank.toString().padStart(2, "0")}</div>
      <div class="event-body">
        <div class="event-meta">
          <span class="category">${event.category}</span>
          <span>${event.regions.join(" / ")}</span>
          <span>热度 ${event.heat.score}</span>
        </div>
        <h2>${escapeHtml(event.titleZh)}</h2>
        <p>${escapeHtml(event.summaryZh)}</p>
        <div class="heatline">
          <span>${escapeHtml(event.heat.reasonZh)}</span>
        </div>
        <div class="sources">
          ${event.sources.map((source) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.name)}</a>`).join("")}
        </div>
      </div>
    </article>
  `;
}

function renderDistributionBar(category: NewsCategory, count: number, total: number): string {
  const width = total === 0 ? 0 : Math.round((count / total) * 100);
  return `
    <div class="distribution-row">
      <span>${category}</span>
      <div class="bar" aria-hidden="true"><i style="width: ${width}%"></i></div>
      <strong>${count}</strong>
    </div>
  `;
}

function formatGeneratedAt(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

void boot();
