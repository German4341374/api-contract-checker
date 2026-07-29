# Design decisions

## Focused OpenAPI subset

The checker deliberately supports a small, predictable subset instead of partially implementing every OpenAPI feature. It discovers `GET` operations, selects the first explicit numeric `2xx` response, dereferences non-circular references, and validates JSON response schemas with Ajv.

This makes the tool useful as a CI smoke contract check while keeping failure messages understandable. Supporting all parameter serialization styles, security schemes, callbacks, links, and polymorphic discriminators would require a much larger request-generation engine.

## Request safety

Only `GET` operations are executed. Concurrency is bounded, every request has a timeout, and retries are limited to gateway or temporary-unavailable statuses (`502`, `503`, and `504`). Retries use exponential backoff. Redirects follow the Node.js fetch default policy.

Headers are mapped to environment variable names in the configuration. The YAML file therefore describes where a value comes from without storing the value. Verbose logs redact authorization and cookie headers.

## Contract result model

Discovery and execution are separate:

1. The parser validates and dereferences the OpenAPI document.
2. Discovery resolves supported operations and records explicit skip reasons.
3. A bounded worker pool executes checks.
4. Status, media type, and schema failures become a common result model.
5. Reporters render that model without rerunning requests.

This separation makes console, JSON, Markdown, and JUnit reports consistent.

## Exit codes

- `0`: all executed contract checks passed; skipped endpoints are allowed.
- `1`: at least one response violated the contract or a request failed.
- `2`: the command, configuration, OpenAPI document, or output operation failed.
