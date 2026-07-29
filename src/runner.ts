import { performance } from "node:perf_hooks";
import { CheckerError } from "./errors.js";
import { executeRequest } from "./http.js";
import { maskHeaders, maskUrl } from "./masking.js";
import { discoverEndpoints } from "./openapi.js";
import { validateSchema } from "./schema.js";
import type {
  CheckFailure,
  CheckResult,
  ContractReport,
  EndpointCheck,
  RuntimeOptions,
} from "./types.js";

export type LogFunction = (message: string) => void;

function mediaType(value: string): string {
  return value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function buildUrl(baseUrl: string, requestPath: string): string {
  try {
    const base = new URL(baseUrl);
    const basePath = base.pathname.replace(/\/$/, "");
    const endpointPath = requestPath.replace(/^\//, "");
    base.pathname = `${basePath}/${endpointPath}`;
    return base.toString();
  } catch (error) {
    throw new CheckerError(`Invalid base URL: ${baseUrl}.`, { cause: error });
  }
}

function ignored(options: RuntimeOptions, operation: string, check: string): boolean {
  return (
    options.ignore.checks[operation]?.includes(
      check as "request" | "status" | "content-type" | "schema",
    ) ?? false
  );
}

function parseResponseBody(body: string): { value?: unknown; error?: CheckFailure } {
  try {
    return { value: JSON.parse(body) as unknown };
  } catch {
    return {
      error: {
        check: "schema",
        message: "Schema validation requires a valid JSON response body.",
        expected: "valid JSON",
        actual: body.slice(0, 200),
      },
    };
  }
}

async function checkEndpoint(
  endpoint: EndpointCheck,
  options: RuntimeOptions,
  log: LogFunction,
): Promise<CheckResult> {
  const url = buildUrl(options.baseUrl, endpoint.requestPath);
  if (options.verbose) {
    log(
      `Checking ${endpoint.operationKey} at ${maskUrl(url)} with headers ${JSON.stringify(maskHeaders(options.headers))}`,
    );
  }

  let response;
  try {
    response = await executeRequest(url, options.headers, options.timeoutMs, options.retries);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown request failure.";
    return {
      operation: endpoint.operationKey,
      outcome: "failed",
      durationMs: 0,
      attempts: 1,
      failures: [{ check: "request", message }],
    };
  }

  const failures: CheckFailure[] = [];
  if (
    !ignored(options, endpoint.operationKey, "status") &&
    response.status !== endpoint.expectedStatus
  ) {
    failures.push({
      check: "status",
      message: `Status mismatch: expected ${endpoint.expectedStatus}, received ${response.status}.`,
      expected: endpoint.expectedStatus,
      actual: response.status,
    });
  }

  if (
    endpoint.expectedContentType !== undefined &&
    !ignored(options, endpoint.operationKey, "content-type") &&
    mediaType(response.contentType) !== mediaType(endpoint.expectedContentType)
  ) {
    failures.push({
      check: "content-type",
      message: `Content-Type mismatch: expected ${endpoint.expectedContentType}, received ${response.contentType || "(missing)"}.`,
      expected: endpoint.expectedContentType,
      actual: response.contentType,
    });
  }

  if (endpoint.schema !== undefined && !ignored(options, endpoint.operationKey, "schema")) {
    const parsed = parseResponseBody(response.body);
    if (parsed.error !== undefined) {
      failures.push(parsed.error);
    } else {
      failures.push(...validateSchema(endpoint.schema, parsed.value));
    }
  }

  return {
    operation: endpoint.operationKey,
    outcome: failures.length === 0 ? "passed" : "failed",
    durationMs: response.durationMs,
    attempts: response.attempts,
    responseStatus: response.status,
    failures,
  };
}

async function mapConcurrent<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      const value = values[index];
      if (value !== undefined) results[index] = await mapper(value);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => worker()),
  );
  return results;
}

export async function runContract(
  specPath: string,
  options: RuntimeOptions,
  log: LogFunction = () => undefined,
): Promise<ContractReport> {
  const started = performance.now();
  const discovery = await discoverEndpoints(specPath, options);
  const checked = await mapConcurrent(discovery.checks, options.concurrency, (endpoint) =>
    checkEndpoint(endpoint, options, log),
  );
  const skipped: CheckResult[] = discovery.skipped.map((endpoint) => ({
    operation: endpoint.operationKey,
    outcome: "skipped",
    durationMs: 0,
    attempts: 0,
    failures: [],
    skipReason: endpoint.reason,
  }));
  const results = [...checked, ...skipped].sort((left, right) =>
    left.operation.localeCompare(right.operation),
  );

  return {
    generatedAt: new Date().toISOString(),
    specPath,
    baseUrl: options.baseUrl,
    summary: {
      total: results.length,
      passed: results.filter((result) => result.outcome === "passed").length,
      failed: results.filter((result) => result.outcome === "failed").length,
      skipped: results.filter((result) => result.outcome === "skipped").length,
      durationMs: Math.round(performance.now() - started),
    },
    results,
  };
}
