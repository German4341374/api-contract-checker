import type { OpenAPIV3 } from "openapi-types";

export type CheckKind = "request" | "status" | "content-type" | "schema";
export type IgnorableCheckKind = Exclude<CheckKind, "request">;
export type ReportFormat = "console" | "json" | "markdown" | "junit";

export interface IgnoreRules {
  readonly operations: readonly string[];
  readonly checks: Readonly<Record<string, readonly IgnorableCheckKind[]>>;
}

export interface CheckerConfig {
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
  readonly concurrency?: number;
  readonly retries?: number;
  readonly pathParameters: Readonly<Record<string, Readonly<Record<string, string | number>>>>;
  readonly headers: Readonly<Record<string, string>>;
  readonly ignore: IgnoreRules;
}

export interface RuntimeOptions {
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly concurrency: number;
  readonly retries: number;
  readonly pathParameters: Readonly<Record<string, Readonly<Record<string, string | number>>>>;
  readonly headers: Readonly<Record<string, string>>;
  readonly ignore: IgnoreRules;
  readonly verbose: boolean;
}

export interface EndpointCheck {
  readonly operationKey: string;
  readonly pathTemplate: string;
  readonly requestPath: string;
  readonly expectedStatus: number;
  readonly expectedContentType?: string;
  readonly schema?: OpenAPIV3.SchemaObject;
}

export interface SkippedEndpoint {
  readonly operationKey: string;
  readonly reason: string;
}

export interface DiscoveryResult {
  readonly checks: readonly EndpointCheck[];
  readonly skipped: readonly SkippedEndpoint[];
}

export interface CheckFailure {
  readonly check: CheckKind;
  readonly message: string;
  readonly path?: string;
  readonly expected?: unknown;
  readonly actual?: unknown;
}

export interface CheckResult {
  readonly operation: string;
  readonly outcome: "passed" | "failed" | "skipped";
  readonly durationMs: number;
  readonly attempts: number;
  readonly responseStatus?: number;
  readonly failures: readonly CheckFailure[];
  readonly skipReason?: string;
}

export interface RunSummary {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly durationMs: number;
}

export interface ContractReport {
  readonly generatedAt: string;
  readonly specPath: string;
  readonly baseUrl: string;
  readonly summary: RunSummary;
  readonly results: readonly CheckResult[];
}

export interface HttpResult {
  readonly status: number;
  readonly contentType: string;
  readonly body: string;
  readonly durationMs: number;
  readonly attempts: number;
}
