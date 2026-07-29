const SENSITIVE_HEADER_NAMES = new Set(["authorization", "cookie", "set-cookie"]);
const SENSITIVE_QUERY_NAMES = new Set(["token", "key", "password", "secret"]);

export function maskHeaders(
  headers: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name,
      SENSITIVE_HEADER_NAMES.has(name.toLowerCase()) ? "[REDACTED]" : value,
    ]),
  );
}

export function maskUrl(value: string): string {
  try {
    const url = new URL(value);
    for (const name of [...url.searchParams.keys()]) {
      if (SENSITIVE_QUERY_NAMES.has(name.toLowerCase())) {
        url.searchParams.set(name, "[REDACTED]");
      }
    }
    return url.toString();
  } catch {
    return value;
  }
}
