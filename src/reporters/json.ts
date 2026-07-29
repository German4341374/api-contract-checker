import type { ContractReport } from "../types.js";

export function jsonReport(report: ContractReport): string {
  return JSON.stringify(report, null, 2);
}
