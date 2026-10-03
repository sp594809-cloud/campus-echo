import pg from "pg";

export function createDatabasePool(connectionString: string) {
  const pool = new pg.Pool({
    connectionString,
    application_name: "campus-echo",
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    statement_timeout: 10000,
    query_timeout: 12000,
    max: 10,
    keepAlive: true,
  });
  // Idle network errors must not terminate the API process. Never log credentials.
  pool.on("error", () => console.error("Campus Echo database connection was interrupted."));
  return pool;
}

export function isDatabaseUnavailable(error: unknown): boolean {
  const seen = new Set<unknown>();
  while (error && typeof error === "object" && !seen.has(error)) {
    seen.add(error);
    const value = error as { code?: string; message?: string; cause?: unknown };
    if (value.code && /^(08|28|53|57P)|^(ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENETUNREACH|EHOSTUNREACH|ENOTFOUND)$/.test(value.code)) return true;
    if (/connection timeout|timeout exceeded when trying to connect|connection terminated|query read timeout/i.test(value.message ?? "")) return true;
    error = value.cause;
  }
  return false;
}
