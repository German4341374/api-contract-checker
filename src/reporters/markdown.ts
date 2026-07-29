import type { ContractReport } from "../types.js";

function escapeCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function markdownReport(report: ContractReport): string {
  const lines = [
    "# API contract report",
    "",
    `- Generated: ${report.generatedAt}`,
    `- Specification: \`${report.specPath}\``,
    `- Base URL: \`${report.baseUrl}\``,
    `- Result: **${report.summary.failed === 0 ? "PASS" : "FAIL"}**`,
    "",
    "| Operation | Outcome | Status | Duration | Attempts |",
    "| --- | --- | ---: | ---: | ---: |",
  ];

  for (const result of report.results) {
    lines.push(
      `| ${escapeCell(result.operation)} | ${result.outcome.toUpperCase()} | ${result.responseStatus ?? "—"} | ${result.durationMs} ms | ${result.attempts} |`,
    );
  }

  const failed = report.results.filter((result) => result.failures.length > 0);
  if (failed.length > 0) {
    lines.push("", "## Contract failures");
    for (const result of failed) {
      lines.push("", `### ${result.operation}`, "");
      for (const failure of result.failures)
        lines.push(`- **${failure.check}:** ${failure.message}`);
    }
  }

  const skipped = report.results.filter((result) => result.skipReason !== undefined);
  if (skipped.length > 0) {
    lines.push("", "## Skipped operations", "");
    for (const result of skipped) lines.push(`- **${result.operation}:** ${result.skipReason}`);
  }

  lines.push(
    "",
    `Summary: ${report.summary.passed} passed, ${report.summary.failed} failed, ${report.summary.skipped} skipped.`,
    "",
  );
  return lines.join("\n");
}
