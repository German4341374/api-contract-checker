# Repository guidance

- Keep source code, tests, documentation, configuration, and commit messages in English.
- Preserve strict TypeScript and avoid global mutable state.
- Never add real credentials, cookies, tokens, private specifications, or production response data.
- Keep the OpenAPI support matrix explicit; do not imply complete standard coverage.
- Add tests for behavior changes and run `npm run check`.
- Use Conventional Commits.
- Keep the runtime image non-root and dependencies pinned through `package-lock.json`.
