#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { Command, InvalidArgumentError, Option } from "commander";
import { loadConfig } from "./config.js";
import { CheckerError } from "./errors.js";
import { renderReport } from "./reporters/index.js";
import { runContract } from "./runner.js";
import type { ReportFormat, RuntimeOptions } from "./types.js";

interface CheckCommandOptions {
  readonly baseUrl?: string;
  readonly config?: string;
  readonly concurrency?: number;
  readonly output?: string;
  readonly report: ReportFormat;
  readonly retries?: number;
  readonly timeout?: number;
  readonly verbose?: boolean;
}

function positiveInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new InvalidArgumentError("Expected a positive integer.");
  }
  return parsed;
}

function nonNegativeInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new InvalidArgumentError("Expected a non-negative integer.");
  }
  return parsed;
}

async function executeCheck(specPath: string, commandOptions: CheckCommandOptions): Promise<void> {
  const config = await loadConfig(commandOptions.config);
  const baseUrl = commandOptions.baseUrl ?? config.baseUrl;
  if (baseUrl === undefined) {
    throw new CheckerError("A base URL is required through --base-url or the config file.");
  }

  const options: RuntimeOptions = {
    baseUrl,
    timeoutMs: commandOptions.timeout ?? config.timeoutMs ?? 5_000,
    concurrency: commandOptions.concurrency ?? config.concurrency ?? 4,
    retries: commandOptions.retries ?? config.retries ?? 2,
    pathParameters: config.pathParameters,
    headers: config.headers,
    ignore: config.ignore,
    verbose: commandOptions.verbose ?? false,
  };
  const report = await runContract(specPath, options, (message) => console.error(message));
  const rendered = renderReport(report, commandOptions.report);

  if (commandOptions.output === undefined) {
    console.log(rendered);
  } else {
    await writeFile(commandOptions.output, rendered, "utf8");
    console.error(`Report written to ${commandOptions.output}.`);
  }
  process.exitCode = report.summary.failed > 0 ? 1 : 0;
}

export function createProgram(): Command {
  const program = new Command()
    .name("api-contract-checker")
    .description("Check live REST API responses against a focused OpenAPI 3.x subset.")
    .version("1.0.0");

  program
    .command("check")
    .description("Discover and check supported GET operations.")
    .argument("<openapi>", "path to an OpenAPI YAML or JSON document")
    .option("--base-url <url>", "base URL of the live API")
    .option("--config <path>", "YAML checker configuration")
    .option("--timeout <milliseconds>", "request timeout", positiveInteger)
    .option("--concurrency <count>", "maximum concurrent requests", positiveInteger)
    .option("--retries <count>", "retries for HTTP 502, 503, and 504", nonNegativeInteger)
    .addOption(
      new Option("--report <format>", "report format")
        .choices(["console", "json", "markdown", "junit"])
        .default("console"),
    )
    .option("--output <path>", "write the report to a file")
    .option("--verbose", "log sanitized request metadata")
    .action(async (specPath: string, options: CheckCommandOptions) => {
      try {
        await executeCheck(specPath, options);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected error.";
        console.error(`Error: ${message}`);
        process.exitCode = 2;
      }
    });

  return program;
}

export async function main(argv: readonly string[] = process.argv): Promise<void> {
  await createProgram().parseAsync(argv);
}

const entryPath = process.argv[1];
if (entryPath !== undefined && import.meta.url === pathToFileURL(entryPath).href) {
  await main();
}
