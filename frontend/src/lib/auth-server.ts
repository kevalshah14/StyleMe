import { betterAuth } from "better-auth";
import Database from "better-sqlite3";

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret) {
  throw new Error("BETTER_AUTH_SECRET environment variable is required");
}

export const auth = betterAuth({
  secret,
  database: new Database("./sqlite.db"),
  emailAndPassword: {
    enabled: true,
  },
});
