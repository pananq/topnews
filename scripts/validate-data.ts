import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LatestNewsSchema, type LatestNews } from "../src/shared/schema";

interface ValidateOptions {
  rejectSample?: boolean;
}

export function validateLatestData(value: unknown, options: ValidateOptions = {}): LatestNews {
  const data = LatestNewsSchema.parse(value);

  if (options.rejectSample && data.status === "sample") {
    throw new Error("Refusing to publish sample data");
  }

  return data;
}

function main(): void {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const dataPath = path.join(root, "data", "latest.json");
  const data = validateLatestData(JSON.parse(fs.readFileSync(dataPath, "utf8")), {
    rejectSample: process.env.REJECT_SAMPLE_DATA === "true",
  });

  console.log(`Validated ${data.events.length} events in ${dataPath}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
