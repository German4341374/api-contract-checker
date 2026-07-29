import type { OpenAPIV3 } from "openapi-types";
import { describe, expect, it } from "vitest";
import { validateSchema } from "../src/schema.js";

const schema: OpenAPIV3.SchemaObject = {
  type: "object",
  additionalProperties: false,
  required: ["id", "state", "profile", "tags"],
  properties: {
    id: { type: "integer" },
    state: { type: "string", enum: ["ready", "busy"] },
    note: { type: "string", nullable: true },
    profile: {
      type: "object",
      required: ["active"],
      properties: { active: { type: "boolean" } },
    },
    tags: { type: "array", items: { type: "string" } },
  },
};

describe("validateSchema", () => {
  it("accepts required fields, enums, arrays, and nested objects", () => {
    expect(
      validateSchema(schema, {
        id: 7,
        state: "ready",
        note: "available",
        profile: { active: true },
        tags: ["api"],
      }),
    ).toEqual([]);
  });

  it("accepts an OpenAPI nullable field", () => {
    expect(
      validateSchema(schema, {
        id: 7,
        state: "ready",
        note: null,
        profile: { active: true },
        tags: [],
      }),
    ).toEqual([]);
  });

  it("reports a missing required field with its JSON path", () => {
    const failures = validateSchema(schema, {
      id: 7,
      state: "ready",
      profile: { active: true },
      tags: [],
    });
    expect(failures).toEqual([]);

    const missing = validateSchema(schema, {
      id: 7,
      state: "ready",
      profile: {},
      tags: [],
    });
    expect(missing.some((failure) => failure.path === "/profile/active")).toBe(true);
  });

  it("reports primitive type differences", () => {
    const failures = validateSchema(schema, {
      id: "7",
      state: "ready",
      profile: { active: true },
      tags: [],
    });
    expect(failures[0]).toMatchObject({ check: "schema", path: "/id", expected: "integer" });
    expect(failures[0]?.message).toContain('received "7"');
  });

  it("reports enum differences", () => {
    const failures = validateSchema(schema, {
      id: 7,
      state: "unknown",
      profile: { active: true },
      tags: [],
    });
    expect(failures).toContainEqual(
      expect.objectContaining({
        path: "/state",
        expected: ["ready", "busy"],
        actual: "unknown",
      }),
    );
  });

  it("reports array and nested object differences", () => {
    const failures = validateSchema(schema, {
      id: 7,
      state: "ready",
      profile: { active: "yes" },
      tags: "api",
    });
    expect(failures.map((failure) => failure.path)).toEqual(
      expect.arrayContaining(["/profile/active", "/tags"]),
    );
  });

  it("converts OpenAPI 3.0 exclusive bounds", () => {
    const bounded = {
      type: "number",
      minimum: 1,
      exclusiveMinimum: true,
    } as OpenAPIV3.SchemaObject;
    expect(validateSchema(bounded, 1)).toHaveLength(1);
    expect(validateSchema(bounded, 2)).toEqual([]);
  });
});
