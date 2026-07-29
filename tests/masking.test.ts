import { describe, expect, it } from "vitest";
import { maskHeaders, maskUrl } from "../src/masking.js";

describe("sensitive data masking", () => {
  it("redacts authorization and cookie headers case-insensitively", () => {
    expect(
      maskHeaders({
        Authorization: "Bearer secret",
        COOKIE: "session=secret",
        Accept: "application/json",
      }),
    ).toEqual({
      Authorization: "[REDACTED]",
      COOKIE: "[REDACTED]",
      Accept: "application/json",
    });
  });

  it("redacts sensitive URL query parameters", () => {
    const masked = maskUrl(
      "https://example.test/items?token=secret&key=secret&password=secret&secret=secret&view=full",
    );
    expect(masked).not.toContain("=secret");
    expect(masked).toContain("view=full");
  });

  it("returns a non-URL value unchanged", () => {
    expect(maskUrl("not a url")).toBe("not a url");
  });
});
