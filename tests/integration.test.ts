import { createServer, type Server } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { executeRequest } from "../src/http.js";
import { runContract } from "../src/runner.js";
import { runtimeOptions } from "./helpers.js";

let server: Server;
let baseUrl: string;
let directory: string;
let specPath: string;
let transientRequests = 0;

beforeAll(async () => {
  server = createServer((request, response) => {
    response.setHeader("content-type", "application/json; charset=utf-8");
    if (request.url === "/healthy") {
      response.writeHead(200).end(JSON.stringify({ id: 1, state: "ready" }));
    } else if (request.url === "/wrong-status") {
      response.writeHead(418).end(JSON.stringify({ message: "teapot" }));
    } else if (request.url === "/wrong-schema") {
      response.writeHead(200).end(JSON.stringify({ id: "wrong", state: "unknown" }));
    } else if (request.url === "/transient") {
      transientRequests += 1;
      response.writeHead(transientRequests === 1 ? 503 : 200).end(JSON.stringify({ ready: true }));
    } else if (request.url === "/slow") {
      setTimeout(() => response.writeHead(200).end("{}"), 100);
    } else {
      response.writeHead(404).end("{}");
    }
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("No test server address.");
  baseUrl = `http://127.0.0.1:${address.port}`;

  directory = await mkdtemp(join(tmpdir(), "api-contract-integration-"));
  specPath = join(directory, "openapi.yaml");
  await writeFile(
    specPath,
    `
openapi: 3.0.3
info: { title: Integration, version: 1.0.0 }
paths:
  /healthy:
    get:
      responses:
        "200":
          description: Healthy
          content:
            application/json:
              schema: { $ref: "#/components/schemas/State" }
  /wrong-status:
    get:
      responses:
        "200":
          description: Wrong status
          content:
            application/json:
              schema:
                type: object
                required: [message]
                properties: { message: { type: string } }
  /wrong-schema:
    get:
      responses:
        "200":
          description: Wrong schema
          content:
            application/json:
              schema: { $ref: "#/components/schemas/State" }
components:
  schemas:
    State:
      type: object
      required: [id, state]
      properties:
        id: { type: integer }
        state: { type: string, enum: [ready, busy] }
`,
    "utf8",
  );
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error === undefined ? resolve() : reject(error))),
  );
  await rm(directory, { recursive: true });
});

describe("mock API integration", () => {
  it("reports one passing endpoint and two contract failures", async () => {
    const report = await runContract(specPath, runtimeOptions({ baseUrl }));
    expect(report.summary).toMatchObject({ total: 3, passed: 1, failed: 2, skipped: 0 });
    expect(
      report.results.find((result) => result.operation === "GET /wrong-status")?.failures,
    ).toEqual([expect.objectContaining({ check: "status", expected: 200, actual: 418 })]);
    expect(
      report.results
        .find((result) => result.operation === "GET /wrong-schema")
        ?.failures.map((failure) => failure.path),
    ).toEqual(expect.arrayContaining(["/id", "/state"]));
  });

  it("retries a transient 503 response and succeeds", async () => {
    transientRequests = 0;
    const response = await executeRequest(`${baseUrl}/transient`, {}, 1_000, 2);
    expect(response).toMatchObject({ status: 200, attempts: 2 });
  });

  it("returns the final retryable response when retry attempts are exhausted", async () => {
    transientRequests = 0;
    const response = await executeRequest(`${baseUrl}/transient`, {}, 1_000, 0);
    expect(response).toMatchObject({ status: 503, attempts: 1 });
  });

  it("fails a request that exceeds its timeout", async () => {
    await expect(executeRequest(`${baseUrl}/slow`, {}, 10, 0)).rejects.toThrow(
      "timed out after 10 ms",
    );
  });
});
