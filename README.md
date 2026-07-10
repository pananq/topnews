# 全球十大新闻

一个部署在 GitHub Pages 上的静态新闻网站。页面每天北京时间早上 8 点展示过去 24 小时全球最热门的十大新闻事件，用中文标题和摘要呈现，并保留原文来源链接。

## 本地开发

```bash
npm install
npm test
npm run dev
```

## 数据生成

```bash
npm run generate
npm run validate:data
```

默认 AI provider 是 DeepSeek。没有当前 provider 对应的 API Key 时，生成脚本会使用确定性的中文 fallback 摘要，并保留来源链接；这保证 GitHub Pages 和本地开发在没有密钥时仍可展示数据。

## GitHub Pages

1. 在仓库 Settings -> Pages 中选择 GitHub Actions。
2. 在仓库 Secrets 中添加 `DEEPSEEK_API_KEY`。
3. 可选：在仓库 Variables 中添加 `AI_PROVIDER=deepseek` 和 `DEEPSEEK_MODEL=deepseek-v4-flash`。
4. 如果要切回 OpenAI，在 Secrets 中添加 `OPENAI_API_KEY`，并在 Variables 中设置 `AI_PROVIDER=openai` 和可选的 `OPENAI_MODEL`。
5. `.github/workflows/update-news.yml` 会在 UTC 00:00 运行，对应北京时间 08:00；它会生成数据、构建 `dist/`，并部署到 GitHub Pages。

## 验证

```bash
npm test
npm run validate:data
npm run build
```
