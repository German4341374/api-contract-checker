import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { CheckerError } from "./errors.js";
import type { CheckerConfig, IgnorableCheckKind } from "./types.js";

const CHECK_KINDS = new Set<IgnorableCheckKind>(["status", "content-type", "schema"]);

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new CheckerError(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function optionalInteger(
  source: Record<string, unknown>,
  key: string,
  minimum: number,
): number | undefined {
  const value = source[key];
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || (value as number) < minimum) {
    throw new CheckerError(`${key} must be an integer greater than or equal to ${minimum}.`);
  }
  return value as number;
}

function parseStringArray(value: unknown, label: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new CheckerError(`${label} must be an array of strings.`);
  }
  return value as string[];
}

function parsePathParameters(value: unknown): Record<string, Record<string, string | number>> {
  if (value === undefined) return {};
  const paths = asRecord(value, "pathParameters");
  return Object.fromEntries(
    Object.entries(paths).map(([path, rawParameters]) => {
      const parameters = asRecord(rawParameters, `pathParameters.${path}`);
      for (const [name, parameter] of Object.entries(parameters)) {
        if (typeof parameter !== "string" && typeof parameter !== "number") {
          throw new CheckerError(`Path parameter ${path}.${name} must be a string or number.`);
        }
      }
      return [path, parameters as Record<string, string | number>];
    }),
  );
}

function parseHeaders(value: unknown): Record<string, string> {
  if (value === undefined) return {};
  const headers = asRecord(value, "headers");
  const resolved: Record<string, string> = {};
  for (const [headerName, environmentName] of Object.entries(headers)) {
    if (typeof environmentName !== "string" || environmentName.length === 0) {
      throw new CheckerError(`headers.${headerName} must name an environment variable.`);
    }
    const headerValue = process.env[environmentName];
    if (headerValue === undefined) {
      throw new CheckerError(
        `Environment variable ${environmentName} is required for header ${headerName}.`,
      );
    }
    resolved[headerName] = headerValue;
  }
  return resolved;
}

function parseIgnore(value: unknown): CheckerConfig["ignore"] {
  if (value === undefined) return { operations: [], checks: {} };
  const ignore = asRecord(value, "ignore");
  const operations = parseStringArray(ignore.operations, "ignore.operations");
  const rawChecks = ignore.checks === undefined ? {} : asRecord(ignore.checks, "ignore.checks");
  const checks: Record<string, IgnorableCheckKind[]> = {};
  for (const [operation, rawKinds] of Object.entries(rawChecks)) {
    const kinds = parseStringArray(rawKinds, `ignore.checks.${operation}`);
    if (kinds.some((kind) => !CHECK_KINDS.has(kind as IgnorableCheckKind))) {
      throw new CheckerError(`ignore.checks.${operation} contains an unsupported check name.`);
    }
    checks[operation] = kinds as IgnorableCheckKind[];
  }
  return { operations, checks };
}

export async function loadConfig(path?: string): Promise<CheckerConfig> {
  if (path === undefined) {
    return { pathParameters: {}, headers: {}, ignore: { operations: [], checks: {} } };
  }

  let raw: unknown;
  try {
    raw = parse(await readFile(path, "utf8")) as unknown;
  } catch (error) {
    throw new CheckerError(`Unable to read configuration ${path}.`, { cause: error });
  }

  const source = asRecord(raw, "Configuration");
  const baseUrl = source.baseUrl;
  if (baseUrl !== undefined && typeof baseUrl !== "string") {
    throw new CheckerError("baseUrl must be a string.");
  }

  const timeoutMs = optionalInteger(source, "timeoutMs", 1);
  const concurrency = optionalInteger(source, "concurrency", 1);
  const retries = optionalInteger(source, "retries", 0);

  return {
    ...(baseUrl === undefined ? {} : { baseUrl }),
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
    ...(concurrency === undefined ? {} : { concurrency }),
    ...(retries === undefined ? {} : { retries }),
    pathParameters: parsePathParameters(source.pathParameters),
    headers: parseHeaders(source.headers),
    ignore: parseIgnore(source.ignore),
  };
}
