# Category-first ranking 最终审查修复报告

## 修复范围

### 1. normalize 分类门槛

- 将分类证据改为 `CATEGORY_EVIDENCE` 结构，明确区分可独立命中的高信号词和必须整体命中的 token 组合。
- `inferCategory` 使用未截断的 `classificationTokens`；`extractKeywords` 仍保留 18 token 上限，仅供聚类使用。
- 移除 `world`、`global`、`united`、`central`、`final`、`player` 等单词的独立分类资格。
- 增加 `central bank`、`united nations`、`security council`、`israel + iran`、`nuclear facilities`、`world cup` 等组合，以及 `diplomatic`、`ceasefire`、`semiconductor`、`olympic` 等高信号词。
- 测试覆盖真实正反例矩阵、18 token 之后才出现分类证据的长文本，以及指定的 oldest dog 反例。

### 2. cluster 同权 tie-break

- 聚合每个候选分类的总 `sourceWeight`、文章数和单一最高来源权重。
- 排序规则固定为：总来源权重、文章数、单一最高来源权重、`CATEGORIES` 顺序。
- 三层平票测试均对原输入和反转输入执行，证明结果不依赖 `Map` 插入顺序。

### 3. provider 失败与 fallback

- `summarizeClusters` 返回 `{ events, status }`，成功为 `fresh`，无 key 或请求/解析失败为 `sample`。
- `generateLatestNews` 直接使用摘要层状态，不再由“配置了 key 且有事件”推断 `fresh`。
- fallback 标题和摘要使用确定性全中文模板，不拼接英文原始标题或摘要，也不含英文字母和阿拉伯数字；来源 URL 仍保留。
- 测试覆盖无 key 和 OpenAI HTTP 500 两条路径。

### 4. OpenAI Responses API 契约

- 新增真实 Responses 风格 mocked response：`output[].content[].type=output_text` 与 JSON `text`。
- 断言 URL 为 `/v1/responses`、模型透传正确、payload 中包含 `cluster.category`、instruction 保留“必须保留输入的预分类”。
- AI 故意返回错误分类 `财经`，最终事件仍由预分类 `科技` 覆盖。
- 该请求实现已满足契约，因此此项新增测试在初始 RED 命令中即通过；它补齐的是缺失的回归保护。

### 5. Reddit 高热度非目标内容

- 新增 `worldnews` 帖子，使用 9,000,000 score 和 800,000 comments 的极端热度数据。
- 标题为 `World's oldest dog celebrates birthday`，断言仍在分类资格门返回空列表，证明热度不会绕过资格过滤。

## RED / GREEN 证据

- RED：`npm test -- tests/pipeline.test.ts tests/socialSources.test.ts tests/generateLatest.test.ts`
  - 退出码 1；34 tests 中 12 failed、22 passed。
  - 失败准确覆盖低信号误收、长文本截断、两种逆序平票、fallback 英文泄漏、provider 500 仍 fresh、Reddit 高热度误收。
  - OpenAI Responses 契约测试初始即通过，原因是生产请求结构已存在。
- 纯中文模板追加 RED：`npm test -- tests/generateLatest.test.ts`
  - 退出码 1；5 tests 中 2 failed，准确显示 fallback 标题包含阿拉伯数字。
- GREEN：`npm test -- tests/pipeline.test.ts tests/socialSources.test.ts tests/generateLatest.test.ts`
  - 退出码 0；3 files、36/36 tests passed。

## 全量验证

- `npm test`：退出码 0；7 files、44/44 tests passed。
- `npm run validate:data`：退出码 0；验证 `data/latest.json` 共 10 个事件。
- `npm run build`：退出码 0；`tsc --noEmit` 与 Vite production build 成功。
- `git diff --check`：在提交前最终执行并确认退出码 0。

## Commit

- 提交主题：`fix: address category ranking final review`
- 分支：`codex/global-news-digest`
- 提交仅包含本次 7 个源码/测试文件和本报告；未纳入或撤销其他工作者的未跟踪文件。

## 自审

- 逐项对照五个 finding，均有直接回归测试。
- 分类逻辑基于 token 集合与组合证据，没有全文 substring 匹配。
- 保留窄主题 feed 的可信 `categoryHint` 行为，仅 broad feed/social inference 使用新门槛。
- 没有扩大 schema：现有 `fresh/sample` 已足够表达 provider 成败。
- OpenAI 与 DeepSeek 成功路径仍覆盖 AI 错误分类，最终类别始终取 cluster 预分类。
- fallback 有意保持通用，避免在无翻译能力时把英文内容伪装成中文摘要；原文事实通过来源链接访问。

## Concerns

- 无阻塞 concern。确定性 fallback 为通用中文占位摘要，不尝试翻译英文事实，这是满足纯中文与不编造内容之间的保守选择。

---

## 最终复审第二轮追加

### Important / Minor 修复

1. **有序相邻分类证据**
   - 分类 token 改为保留顺序与所有词位的序列，组合证据通过滑动窗口匹配有序相邻 n-gram。
   - 不再使用 `Set` 共现判断组合；`security ... council`、`world ... cup`、`interest ... rate` 三个指定反例均返回无分类。
   - `extractKeywords` 使用独立的 `clusteringTokens`，继续负责同义词归一、停用词过滤、去重和 18-token 上限；分类与聚类职责保持分离。

2. **AI 分类 token**
   - 分类阶段保留 `artificial` 与 `intelligence` 原 token，并显式匹配相邻短语 `artificial intelligence`。
   - 字面量 `AI` 归一为两字符 `ai`，作为科技高信号词，不经过聚类的长度过滤门槛。
   - 三个指定标题均稳定分类为科技。

3. **provider 事件数量契约**
   - provider 解析结果必须是数组，且事件数与 clusters 数完全相等，才允许返回 `fresh`。
   - 0、少返回和多返回全部抛入统一 fallback 路径，整批事件使用确定性摘要并标记 `sample`。
   - 两个真实 cluster 的来源链接在整批 fallback 后仍分别对应输入来源。

4. **国际危机唯一分类**
   - `Israel strikes Iran nuclear facilities amid diplomatic crisis` 固定断言为政治。
   - 相邻 `nuclear facilities` 与高信号 `diplomatic` 各贡献一项证据，平分时按既有 `CATEGORIES` 固定顺序选择政治，结果稳定且不依赖全文匹配。

### 第二轮 RED / GREEN

- RED：`npm test -- tests/pipeline.test.ts tests/generateLatest.test.ts`
  - 退出码 1；41 tests 中 9 failed、32 passed。
  - 三个非相邻组合误收、三个 AI 标题漏收，以及 provider 返回 0/1/3 条时仍为 `fresh` 均按预期失败。
- 唯一分类 RED：`npm test -- tests/pipeline.test.ts -t "accepts a high-signal international political crisis"`
  - 退出码 1；旧实现返回国际，唯一预期政治断言失败。
- GREEN：`npm test -- tests/pipeline.test.ts tests/generateLatest.test.ts tests/socialSources.test.ts`
  - 退出码 0；3 files、45/45 tests passed。

### 第二轮全量验证

- `npm test`：退出码 0；7 files、53/53 tests passed。
- `npm run validate:data`：退出码 0；验证 10 个事件。
- `npm run build`：退出码 0；`tsc --noEmit` 与 Vite production build 成功。
- `git diff --check`：退出码 0。

### 第二轮 Commit

- 提交主题：`fix: tighten category evidence and AI batches`
- 分支：`codex/global-news-digest`
- 仅包含本轮直接相关源码、测试与本报告追加内容。

### 第二轮自审与 Concerns

- 所有新增行为均有先失败后通过的直接测试；空数组、少返回、多返回均明确覆盖。
- 分类组合只读取 token 序列，不做全文 substring；停用词仍占据分类序列位置，不会制造虚假的跨词相邻。
- provider 数量不一致不会混用部分 AI 输出，避免页面出现 `fresh` 与 fallback 内容混杂。
- 无阻塞 concern；数量不一致采用整批回退是刻意的原子性策略。
