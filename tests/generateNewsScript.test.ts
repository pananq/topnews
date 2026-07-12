import { describe, expect, it } from "vitest";
import { selectLatestForWrite } from "../scripts/generate-news";
import { SAMPLE_LATEST_NEWS } from "../src/shared/sampleData";

describe("selectLatestForWrite", () => {
  it("keeps existing non-sample data when a generation returns sample data", () => {
    const existing = { ...SAMPLE_LATEST_NEWS, status: "fresh" as const, generatedAt: "2026-07-11T16:11:30.893Z" };

    expect(selectLatestForWrite(SAMPLE_LATEST_NEWS, existing)).toBe(existing);
  });

  it("uses newly generated non-sample data", () => {
    const generated = { ...SAMPLE_LATEST_NEWS, status: "partial" as const, generatedAt: "2026-07-12T01:58:14.750Z" };
    const existing = { ...SAMPLE_LATEST_NEWS, status: "fresh" as const, generatedAt: "2026-07-11T16:11:30.893Z" };

    expect(selectLatestForWrite(generated, existing)).toBe(generated);
  });
});
