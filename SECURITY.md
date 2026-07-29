# Security policy

## Reporting

Report vulnerabilities through GitHub Security Advisories. Do not open a public issue for a suspected vulnerability.

## Operational guidance

- Use a read-only API credential with the minimum scope required for `GET` requests.
- Supply header values through environment variables, never through committed YAML.
- Run the checker only against hosts you are authorized to test.
- Treat generated reports as potentially sensitive because validation diffs can contain response values.
- Review reports before uploading them to a CI artifact store.

The checker redacts `Authorization`, `Cookie`, and `Set-Cookie` values from verbose request metadata. It does not print response bodies, but individual failing values may appear in schema diffs.

## Supported versions

Security fixes are provided for the latest release on the default branch.
