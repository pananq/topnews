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
