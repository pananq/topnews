import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "data", "latest.json");
const target = path.join(root, "dist", "data", "latest.json");

await fs.mkdir(path.dirname(target), { recursive: true });
await fs.copyFile(source, target);
console.log(`Copied ${source} to ${target}`);
