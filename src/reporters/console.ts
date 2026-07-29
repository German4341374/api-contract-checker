import type { ContractReport } from "../types.js";

export function consoleReport(report: ContractReport): string {
  const lines = [
    "API Contract Check",
    `Spec: ${report.specPath}`,
    `Base URL: ${report.baseUrl}`,
    "",
  ];

  for (const result of report.results) {
    const marker =
      result.outcome === "passed" ? "PASS" : result.outcome === "failed" ? "FAIL" : "SKIP";
    lines.push(
      `[${marker}] ${result.operation} (${result.durationMs} ms, ${result.attempts} attempt${result.attempts === 1 ? "" : "s"})`,
    );
    if (result.skipReason !== undefined) lines.push(`  ${result.skipReason}`);
    for (const failure of result.failures) lines.push(`  - ${failure.message}`);
  }

  lines.push(
    "",
    `Summary: ${report.summary.passed} passed, ${report.summary.failed} failed, ${report.summary.skipped} skipped (${report.summary.total} total)`,
  );
  return lines.join("\n");
}
