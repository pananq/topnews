import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("GitHub Actions workflow", () => {
  it("runs every day at UTC midnight for Beijing 8 AM", () => {
    const workflow = fs.readFileSync(".github/workflows/update-news.yml", "utf8");

    expect(workflow).toContain("0 0 * * *");
    expect(workflow).toContain("npm run generate");
    expect(workflow).toContain("npm run build");
    expect(workflow).toContain("OPENAI_API_KEY");
    expect(workflow).toContain("actions/deploy-pages");
  });
});
