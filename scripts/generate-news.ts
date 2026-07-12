import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateLatestNews } from "../src/pipeline/generateLatest";
import { LatestNewsSchema, type LatestNews } from "../src/shared/schema";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(root, "data", "latest.json");

export function selectLatestForWrite(generated: LatestNews, existing?: LatestNews): LatestNews {
  if (generated.status === "sample" && existing && existing.status !== "sample") {
    console.warn("Generated sample data; keeping existing non-sample digest.");
    return existing;
  }

  return generated;
}

async function readExistingLatest(): Promise<LatestNews | undefined> {
  try {
    return LatestNewsSchema.parse(JSON.parse(await fs.readFile(outputPath, "utf8")));
  } catch {
    return undefined;
  }
}

async function main(): Promise<void> {
  const generated = await generateLatestNews({
    aiProvider: process.env.AI_PROVIDER === "openai" ? "openai" : "deepseek",
    deepseekApiKey: process.env.DEEPSEEK_API_KEY,
    deepseekModel: process.env.DEEPSEEK_MODEL,
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL,
  });
  const latest = selectLatestForWrite(generated, await readExistingLatest());

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(latest, null, 2)}\n`, "utf8");
  console.log(`Wrote ${latest.events.length} events to ${outputPath}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
