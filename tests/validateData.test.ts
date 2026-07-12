import { describe, expect, it } from "vitest";
import { SAMPLE_LATEST_NEWS } from "../src/shared/sampleData";
import { validateLatestData } from "../scripts/validate-data";

describe("validateLatestData", () => {
  it("rejects sample data when CI publishing requires generated data", () => {
    expect(() => validateLatestData(SAMPLE_LATEST_NEWS, { rejectSample: true })).toThrow("Refusing to publish sample data");
  });

  it("accepts non-sample data when CI publishing requires generated data", () => {
    expect(() => validateLatestData({ ...SAMPLE_LATEST_NEWS, status: "partial" }, { rejectSample: true })).not.toThrow();
  });
});
