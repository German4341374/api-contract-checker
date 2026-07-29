import { consoleReport } from "./console.js";
import { jsonReport } from "./json.js";
import { junitReport } from "./junit.js";
import { markdownReport } from "./markdown.js";
import type { ContractReport, ReportFormat } from "../types.js";

export function renderReport(report: ContractReport, format: ReportFormat): string {
  switch (format) {
    case "console":
      return consoleReport(report);
    case "json":
      return jsonReport(report);
    case "markdown":
      return markdownReport(report);
    case "junit":
      return junitReport(report);
  }
}
