import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateLatestNews } from "../src/pipeline/generateLatest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(root, "data", "latest.json");

const latest = await generateLatestNews({
  aiProvider: process.env.AI_PROVIDER === "openai" ? "openai" : "deepseek",
  deepseekApiKey: process.env.DEEPSEEK_API_KEY,
  deepseekModel: process.env.DEEPSEEK_MODEL,
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL,
});

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(latest, null, 2)}\n`, "utf8");
console.log(`Wrote ${latest.events.length} events to ${outputPath}`);
