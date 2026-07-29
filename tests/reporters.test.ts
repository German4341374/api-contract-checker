import { describe, expect, it } from "vitest";
import { renderReport } from "../src/reporters/index.js";
import { sampleReport } from "./helpers.js";

describe("reporters", () => {
  it("renders a readable console report", () => {
    const output = renderReport(sampleReport(), "console");
    expect(output).toContain("[PASS] GET /healthy");
    expect(output).toContain("[FAIL] GET /broken");
    expect(output).toContain("1 passed, 1 failed, 1 skipped");
  });

  it("renders machine-readable JSON", () => {
    const output = JSON.parse(renderReport(sampleReport(), "json")) as {
      summary: { failed: number };
    };
    expect(output.summary.failed).toBe(1);
  });

  it("renders a Markdown summary and failure details", () => {
    const output = renderReport(sampleReport(), "markdown");
    expect(output).toContain("| GET /broken | FAILED | 500 |");
    expect(output).toContain("## Contract failures");
    expect(output).toContain("## Skipped operations");
  });

  it("renders valid JUnit-style test cases", () => {
    const output = renderReport(sampleReport(), "junit");
    expect(output).toContain('<testsuite name="api-contract-checker" tests="3" failures="1"');
    expect(output).toContain("<failure");
    expect(output).toContain("<skipped");
  });
});
