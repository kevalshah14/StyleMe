import { betterAuth } from "better-auth";
import Database from "better-sqlite3";
import path from "node:path";

/**
 * Always use an absolute path. A relative `./sqlite.db` depends on `process.cwd()`,
 * which differs if you start Next from the repo root vs `frontend/`, causing empty DBs
 * and intermittent "no such table: user" errors.
 */
const databaseFile =
  process.env.BETTER_AUTH_DATABASE_PATH?.trim() ||
  path.join(process.cwd(), "sqlite.db");

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret) {
  throw new Error("BETTER_AUTH_SECRET environment variable is required");
}

/**
 * Public URL of this Next app (where /api/auth lives). Defaults to dev server on 3000.
 * If BETTER_AUTH_URL points at another port (e.g. 3001) but you open http://localhost:3000,
 * sign-in fails with "Invalid origin" unless that origin is also in trustedOrigins below.
 */
const baseURL =
  process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

const trustedOrigins = [
  ...new Set([
    baseURL,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
  ]),
];

export const auth = betterAuth({
  secret,
  baseURL,
  trustedOrigins,
  database: new Database(databaseFile),
  emailAndPassword: {
    enabled: true,
  },
});
