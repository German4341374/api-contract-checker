import { performance } from "node:perf_hooks";
import { CheckerError } from "./errors.js";
import { maskUrl } from "./masking.js";
import type { HttpResult } from "./types.js";

const RETRYABLE_STATUSES = new Set([502, 503, 504]);

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export async function executeRequest(
  url: string,
  headers: Readonly<Record<string, string>>,
  timeoutMs: number,
  retries: number,
): Promise<HttpResult> {
  const started = performance.now();

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: "GET",
        headers,
        redirect: "follow",
        signal: controller.signal,
      });
      const body = await response.text();
      if (RETRYABLE_STATUSES.has(response.status) && attempt <= retries) {
        await delay(100 * 2 ** (attempt - 1));
        continue;
      }
      return {
        status: response.status,
        contentType: response.headers.get("content-type") ?? "",
        body,
        durationMs: Math.round(performance.now() - started),
        attempts: attempt,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new CheckerError(`Request to ${maskUrl(url)} timed out after ${timeoutMs} ms.`, {
          cause: error,
        });
      }
      throw new CheckerError(`Request to ${maskUrl(url)} failed.`, { cause: error });
    } finally {
      clearTimeout(timer);
    }
  }

  throw new CheckerError(`Request to ${maskUrl(url)} did not produce a response.`);
}
