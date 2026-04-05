/**
 * Runs Better Auth SQLite migrations once when the Node.js server starts.
 * Without this, `user` / `session` / `account` / `verification` tables may be missing.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") {
    return;
  }

  const { auth } = await import("@/lib/auth-server");
  const { getMigrations } = await import("better-auth/db/migration");
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();
}
