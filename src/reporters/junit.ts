import type { ContractReport } from "../types.js";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function junitReport(report: ContractReport): string {
  const cases = report.results.map((result) => {
    const attributes = `classname="api-contract" name="${escapeXml(result.operation)}" time="${(result.durationMs / 1000).toFixed(3)}"`;
    if (result.outcome === "skipped") {
      return `    <testcase ${attributes}><skipped message="${escapeXml(result.skipReason ?? "Skipped")}"/></testcase>`;
    }
    if (result.outcome === "failed") {
      const details = result.failures.map((failure) => failure.message).join("\n");
      return `    <testcase ${attributes}><failure message="Contract mismatch">${escapeXml(details)}</failure></testcase>`;
    }
    return `    <testcase ${attributes}/>`;
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuite name="api-contract-checker" tests="${report.summary.total}" failures="${report.summary.failed}" skipped="${report.summary.skipped}" time="${(report.summary.durationMs / 1000).toFixed(3)}" timestamp="${escapeXml(report.generatedAt)}">`,
    ...cases,
    "</testsuite>",
    "",
  ].join("\n");
}
