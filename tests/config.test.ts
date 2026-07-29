import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

const directories: string[] = [];

async function configFile(contents: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "api-contract-checker-"));
  directories.push(directory);
  const path = join(directory, "checker.yaml");
  await writeFile(path, contents, "utf8");
  return path;
}

afterEach(async () => {
  delete process.env.TEST_API_AUTHORIZATION;
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe("loadConfig", () => {
  it("returns safe defaults when no path is provided", async () => {
    await expect(loadConfig()).resolves.toEqual({
      pathParameters: {},
      headers: {},
      ignore: { operations: [], checks: {} },
    });
  });

  it("loads path values, limits, retries, and ignore rules", async () => {
    const path = await configFile(`
baseUrl: http://localhost:3000
timeoutMs: 100
concurrency: 2
retries: 0
pathParameters:
  /users/{id}:
    id: 42
ignore:
  operations: [GET /ignored]
  checks:
    GET /legacy: [status, schema]
`);
    const config = await loadConfig(path);
    expect(config.retries).toBe(0);
    expect(config.pathParameters["/users/{id}"]?.id).toBe(42);
    expect(config.ignore.checks["GET /legacy"]).toEqual(["status", "schema"]);
  });

  it("resolves header values only from named environment variables", async () => {
    process.env.TEST_API_AUTHORIZATION = "Bearer local-test";
    const path = await configFile("headers:\n  Authorization: TEST_API_AUTHORIZATION\n");
    await expect(loadConfig(path)).resolves.toMatchObject({
      headers: { Authorization: "Bearer local-test" },
    });
  });

  it("fails when a required header environment variable is absent", async () => {
    const path = await configFile("headers:\n  Authorization: TEST_API_AUTHORIZATION\n");
    await expect(loadConfig(path)).rejects.toThrow("Environment variable TEST_API_AUTHORIZATION");
  });

  it("rejects invalid limits and ignore check names", async () => {
    const badLimit = await configFile("concurrency: 0\n");
    await expect(loadConfig(badLimit)).rejects.toThrow("greater than or equal to 1");

    const badIgnore = await configFile("ignore:\n  checks:\n    GET /x: [request]\n");
    await expect(loadConfig(badIgnore)).rejects.toThrow("unsupported check name");
  });
});
