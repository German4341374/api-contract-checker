import type { ContractReport, RuntimeOptions } from "../src/types.js";

export function runtimeOptions(overrides: Partial<RuntimeOptions> = {}): RuntimeOptions {
  return {
    baseUrl: "http://127.0.0.1:3000",
    timeoutMs: 1_000,
    concurrency: 2,
    retries: 1,
    pathParameters: {},
    headers: {},
    ignore: { operations: [], checks: {} },
    verbose: false,
    ...overrides,
  };
}

export function sampleReport(): ContractReport {
  return {
    generatedAt: "2026-01-02T03:04:05.000Z",
    specPath: "openapi.yaml",
    baseUrl: "http://localhost:3000",
    summary: {
      total: 3,
      passed: 1,
      failed: 1,
      skipped: 1,
      durationMs: 25,
    },
    results: [
      {
        operation: "GET /healthy",
        outcome: "passed",
        durationMs: 10,
        attempts: 1,
        responseStatus: 200,
        failures: [],
      },
      {
        operation: "GET /broken",
        outcome: "failed",
        durationMs: 15,
        attempts: 1,
        responseStatus: 500,
        failures: [
          {
            check: "status",
            message: "Status mismatch: expected 200, received 500.",
            expected: 200,
            actual: 500,
          },
        ],
      },
      {
        operation: "GET /users/{id}",
        outcome: "skipped",
        durationMs: 0,
        attempts: 0,
        failures: [],
        skipReason: "Missing required path parameter values: id.",
      },
    ],
  };
}
