# Contributing

Contributions should stay within the documented OpenAPI subset and preserve deterministic reports.

## Workflow

1. Create a focused branch.
2. Install dependencies with `npm ci`.
3. Add or update tests for behavior changes.
4. Run `npm run check`.
5. Build the container when Docker is available.
6. Open a pull request using the repository template.

Use [Conventional Commits](https://www.conventionalcommits.org/) such as:

- `feat: add response header assertions`
- `fix: preserve a base URL path prefix`
- `docs: clarify path parameter configuration`
- `test: cover retry exhaustion`

Do not include credentials, private API specifications, production response bodies, or personal data in issues, fixtures, or commits.
