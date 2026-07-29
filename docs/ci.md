# CI integration

The repository workflow has read-only repository permissions and two jobs.

## Quality and tests

The job installs the lockfile with Node.js 24.14.1, audits production dependencies, checks Prettier formatting, runs ESLint and strict TypeScript, executes Vitest with coverage thresholds, builds distributable JavaScript, inspects the npm package, and uploads `dist/` plus the coverage summary for 14 days.

## Container build

The container job starts only after quality checks pass. It builds the multi-stage Dockerfile, proves that the runtime user ID is not `0`, and runs the packaged CLI help command.

Concurrency cancellation stops stale runs for the same branch. No workflow publishes a package or image and no secret is required.

## Using a JUnit report in another pipeline

Run the checker against an authorized test deployment and always upload the report, even when the checker returns exit code `1`:

```yaml
- name: Check deployed API contract
  run: |
    api-contract-checker check openapi.yaml \
      --base-url "${TEST_BASE_URL}" \
      --report junit \
      --output contract-results.xml

- name: Upload contract result
  if: always()
  uses: actions/upload-artifact@v7.0.1
  with:
    name: contract-results
    path: contract-results.xml
```
