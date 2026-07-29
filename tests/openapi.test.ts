import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { discoverEndpoints } from "../src/openapi.js";
import { runtimeOptions } from "./helpers.js";

const directories: string[] = [];

async function specification(contents: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "api-contract-openapi-"));
  directories.push(directory);
  const path = join(directory, "openapi.yaml");
  await writeFile(path, contents, "utf8");
  return path;
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

const spec = `
openapi: 3.0.3
info: { title: Discovery, version: 1.0.0 }
paths:
  /health:
    get:
      responses:
        "204": { description: Healthy }
  /users/{id}:
    get:
      parameters:
        - { in: path, name: id, required: true, schema: { type: integer } }
      responses:
        "200":
          description: User
          content:
            application/json:
              schema: { type: object }
  /default-only:
    get:
      responses:
        default: { description: No explicit success response }
`;

describe("discoverEndpoints", () => {
  it("discovers GET operations and substitutes configured path parameters", async () => {
    const path = await specification(spec);
    const result = await discoverEndpoints(
      path,
      runtimeOptions({ pathParameters: { "/users/{id}": { id: 42 } } }),
    );
    expect(result.checks.map((check) => check.requestPath)).toEqual(["/health", "/users/42"]);
    expect(result.skipped[0]?.reason).toContain("No explicit numeric 2xx");
  });

  it("skips required path parameters without configured values", async () => {
    const path = await specification(spec);
    const result = await discoverEndpoints(path, runtimeOptions());
    expect(
      result.skipped.find((item) => item.operationKey === "GET /users/{id}")?.reason,
    ).toContain("id");
  });

  it("honors operation ignore rules", async () => {
    const path = await specification(spec);
    const result = await discoverEndpoints(
      path,
      runtimeOptions({
        ignore: { operations: ["GET /health"], checks: {} },
      }),
    );
    expect(result.checks.some((check) => check.operationKey === "GET /health")).toBe(false);
    expect(result.skipped.find((item) => item.operationKey === "GET /health")?.reason).toContain(
      "ignored",
    );
  });

  it("rejects an invalid OpenAPI document", async () => {
    const path = await specification("not: openapi\n");
    await expect(discoverEndpoints(path, runtimeOptions())).rejects.toThrow("is invalid");
  });
});
