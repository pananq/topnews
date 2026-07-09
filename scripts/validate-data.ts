import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LatestNewsSchema } from "../src/shared/schema";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = path.join(root, "data", "latest.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

LatestNewsSchema.parse(data);
console.log(`Validated ${data.events.length} events in ${dataPath}`);
