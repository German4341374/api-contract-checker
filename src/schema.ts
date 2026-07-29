import { Ajv } from "ajv";
import addFormatsImport from "ajv-formats/dist/index.js";
import type { AnySchema, ErrorObject } from "ajv";
import type { OpenAPIV3 } from "openapi-types";
import { CheckerError } from "./errors.js";
import type { CheckFailure } from "./types.js";

const REMOVED_OPENAPI_KEYWORDS = new Set([
  "deprecated",
  "discriminator",
  "example",
  "externalDocs",
  "readOnly",
  "xml",
  "writeOnly",
]);

const addFormats = addFormatsImport as unknown as (ajv: Ajv) => Ajv;

function convertSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(convertSchema);
  if (typeof value !== "object" || value === null) return value;

  const source = value as Record<string, unknown>;
  const converted: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(source)) {
    if (key === "nullable" || REMOVED_OPENAPI_KEYWORDS.has(key)) continue;
    converted[key] = convertSchema(child);
  }

  if (source.exclusiveMinimum === true && typeof source.minimum === "number") {
    converted.exclusiveMinimum = source.minimum;
    delete converted.minimum;
  } else if (source.exclusiveMinimum === false) {
    delete converted.exclusiveMinimum;
  }
  if (source.exclusiveMaximum === true && typeof source.maximum === "number") {
    converted.exclusiveMaximum = source.maximum;
    delete converted.maximum;
  } else if (source.exclusiveMaximum === false) {
    delete converted.exclusiveMaximum;
  }

  if (source.nullable === true) {
    return { anyOf: [converted, { type: "null" }] };
  }
  return converted;
}

function actualAtPath(data: unknown, instancePath: string): unknown {
  if (instancePath.length === 0) return data;
  return instancePath
    .split("/")
    .slice(1)
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))
    .reduce<unknown>((current, part) => {
      if (typeof current !== "object" || current === null) return undefined;
      return (current as Record<string, unknown>)[part];
    }, data);
}

function expectedFromError(error: ErrorObject): unknown {
  switch (error.keyword) {
    case "type":
      return error.params.type;
    case "enum":
      return error.params.allowedValues;
    case "required":
      return `required property ${String(error.params.missingProperty)}`;
    default:
      return error.message ?? error.keyword;
  }
}

function failureFromError(error: ErrorObject, data: unknown): CheckFailure {
  const path =
    error.keyword === "required"
      ? `${error.instancePath}/${String(error.params.missingProperty)}`
      : error.instancePath || "/";
  const actual = error.keyword === "required" ? undefined : actualAtPath(data, error.instancePath);
  const expected = expectedFromError(error);
  return {
    check: "schema",
    message: `Schema mismatch at ${path}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`,
    path,
    expected,
    actual,
  };
}

export function validateSchema(
  schema: OpenAPIV3.SchemaObject,
  data: unknown,
): readonly CheckFailure[] {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  try {
    const validate = ajv.compile(convertSchema(schema) as AnySchema);
    if (validate(data)) return [];
    return (validate.errors ?? []).map((error) => failureFromError(error, data));
  } catch (error) {
    throw new CheckerError("The response schema uses an unsupported construct.", { cause: error });
  }
}
