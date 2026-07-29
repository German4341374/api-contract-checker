import SwaggerParser from "@apidevtools/swagger-parser";
import type { OpenAPIV3 } from "openapi-types";
import { CheckerError } from "./errors.js";
import type { DiscoveryResult, EndpointCheck, RuntimeOptions, SkippedEndpoint } from "./types.js";

function isReference(value: unknown): value is OpenAPIV3.ReferenceObject {
  return typeof value === "object" && value !== null && "$ref" in value;
}

function operationParameters(
  pathItem: OpenAPIV3.PathItemObject,
  operation: OpenAPIV3.OperationObject,
): OpenAPIV3.ParameterObject[] {
  const parameters = new Map<string, OpenAPIV3.ParameterObject>();
  for (const parameter of [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])]) {
    if (!isReference(parameter)) parameters.set(`${parameter.in}:${parameter.name}`, parameter);
  }
  return [...parameters.values()];
}

function resolveRequestPath(
  pathTemplate: string,
  operationKey: string,
  parameters: readonly OpenAPIV3.ParameterObject[],
  configured: RuntimeOptions["pathParameters"],
): { requestPath?: string; missing: readonly string[] } {
  const values = configured[pathTemplate] ?? configured[operationKey] ?? {};
  const requiredPathParameters = parameters.filter(
    (parameter) => parameter.in === "path" && parameter.required,
  );
  const missing = requiredPathParameters
    .map((parameter) => parameter.name)
    .filter((name) => values[name] === undefined);
  if (missing.length > 0) return { missing };

  const requestPath = requiredPathParameters.reduce(
    (path, parameter) =>
      path.replaceAll(`{${parameter.name}}`, encodeURIComponent(String(values[parameter.name]))),
    pathTemplate,
  );
  return { requestPath, missing: [] };
}

function selectExpectedResponse(operation: OpenAPIV3.OperationObject):
  | {
      status: number;
      contentType?: string;
      schema?: OpenAPIV3.SchemaObject;
    }
  | undefined {
  const statusKey = Object.keys(operation.responses)
    .filter((key) => /^2\d\d$/.test(key))
    .sort()[0];
  if (statusKey === undefined) return undefined;

  const response = operation.responses[statusKey];
  if (response === undefined || isReference(response)) {
    return { status: Number(statusKey) };
  }

  const contentTypes = Object.keys(response.content ?? {});
  const contentType =
    contentTypes.find((candidate) => candidate.toLowerCase() === "application/json") ??
    contentTypes.find((candidate) => candidate.toLowerCase().endsWith("+json")) ??
    contentTypes[0];
  if (contentType === undefined) return { status: Number(statusKey) };

  const media = response.content?.[contentType];
  const schema = media?.schema;
  return {
    status: Number(statusKey),
    contentType,
    ...(schema === undefined || isReference(schema) ? {} : { schema }),
  };
}

export async function discoverEndpoints(
  specPath: string,
  options: RuntimeOptions,
): Promise<DiscoveryResult> {
  let document: OpenAPIV3.Document;
  try {
    document = (await SwaggerParser.validate(specPath, {
      dereference: { circular: "ignore" },
    })) as OpenAPIV3.Document;
  } catch (error) {
    throw new CheckerError(`OpenAPI document ${specPath} is invalid.`, { cause: error });
  }

  if (!("openapi" in document) || !document.openapi.startsWith("3.")) {
    throw new CheckerError("Only OpenAPI 3.x documents are supported.");
  }

  const checks: EndpointCheck[] = [];
  const skipped: SkippedEndpoint[] = [];

  for (const pathTemplate of Object.keys(document.paths).sort()) {
    const pathItem = document.paths[pathTemplate];
    if (pathItem === undefined || isReference(pathItem) || pathItem.get === undefined) continue;

    const operationKey = `GET ${pathTemplate}`;
    if (options.ignore.operations.includes(operationKey)) {
      skipped.push({ operationKey, reason: "Operation ignored by configuration." });
      continue;
    }

    const resolvedPath = resolveRequestPath(
      pathTemplate,
      operationKey,
      operationParameters(pathItem, pathItem.get),
      options.pathParameters,
    );
    if (resolvedPath.requestPath === undefined) {
      skipped.push({
        operationKey,
        reason: `Missing required path parameter values: ${resolvedPath.missing.join(", ")}.`,
      });
      continue;
    }

    const response = selectExpectedResponse(pathItem.get);
    if (response === undefined) {
      skipped.push({
        operationKey,
        reason: "No explicit numeric 2xx response is defined.",
      });
      continue;
    }

    checks.push({
      operationKey,
      pathTemplate,
      requestPath: resolvedPath.requestPath,
      expectedStatus: response.status,
      ...(response.contentType === undefined ? {} : { expectedContentType: response.contentType }),
      ...(response.schema === undefined ? {} : { schema: response.schema }),
    });
  }

  return { checks, skipped };
}
