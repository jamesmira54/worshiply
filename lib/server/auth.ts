import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Account, Role, UserSummary } from "@/types/user";
import { database } from "./db";
import { SESSION_COOKIE, SESSION_DAYS, sessionToken } from "./http";
import {
  hashPassword,
  normalizeUsername,
  validatePassword,
  validateUsername,
  verifyPassword,
} from "./passwords";
import { ApiError } from "./validation";

const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;
// Verified against unknown usernames so timing does not reveal which exist.
const DUMMY_HASH = `scrypt$${"0".repeat(32)}$${"0".repeat(128)}`;

const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

async function sessionAccount(token?: string): Promise<Account | null> {
  if (!token) return null;
  const db = await database();
  const hash = tokenHash(token);
  const result = await db.execute({
    sql: "SELECT u.id, u.username, u.role, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?",
    args: [hash],
  });
  const row = result.rows[0];
  if (!row) return null;
  if (String(row.expires_at) <= new Date().toISOString()) {
    await db.execute({ sql: "DELETE FROM sessions WHERE token_hash = ?", args: [hash] });
    return null;
  }
  return { id: String(row.id), username: String(row.username), role: row.role as Role };
}

export function currentUser(request: NextRequest) {
  return sessionAccount(sessionToken(request));
}

// For server components, looked up once per request. A storage outage shows the
// signed-out view instead of breaking public pages; the API reports the outage itself.
export const pageAccount = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  try {
    return await sessionAccount(token && /^[a-f0-9]{64}$/.test(token) ? token : undefined);
  } catch (error) {
    console.error("Session lookup failed", {
      type: error instanceof Error ? error.name : "UnknownError",
    });
    return null;
  }
});

export function requireAccount(account: Account | null): asserts account is Account {
  if (!account) throw new ApiError(401, "Sign in to continue.");
}

export function requireAdmin(account: Account | null): asserts account is Account {
  requireAccount(account);
  if (account.role !== "admin")
    throw new ApiError(403, "Only the admin can make changes.");
}

export async function signIn(body: unknown) {
  const input = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (typeof input.username !== "string" || typeof input.password !== "string" || !input.username.trim() || !input.password)
    throw new ApiError(400, "Enter your username and password.");
  const db = await database();
  const result = await db.execute({
    sql: "SELECT id, username, role, password_hash, locked_until FROM users WHERE username = ?",
    args: [normalizeUsername(input.username)],
  });
  const row = result.rows[0];
  const denied = new ApiError(401, "Incorrect username or password.");
  if (!row) {
    await verifyPassword(input.password, DUMMY_HASH);
    throw denied;
  }
  const now = new Date();
  const locked = new ApiError(429, `Too many attempts. Try again in ${LOCK_MINUTES} minutes.`);
  // Reserve the attempt before checking the password, so parallel requests
  // cannot get more than MAX_FAILURES guesses in one window. The update that
  // records the last allowed attempt also sets the lock, so an interrupted
  // request cannot leave the counter stuck; after a lock expires the count
  // starts again at 1. A successful sign-in clears both below.
  const count = "CASE WHEN locked_until IS NOT NULL THEN 1 ELSE failed_attempts + 1 END";
  const reserved = await db.execute({
    sql: `UPDATE users SET failed_attempts = ${count}, locked_until = CASE WHEN ${count} >= ? THEN ? ELSE NULL END WHERE id = ? AND (locked_until IS NULL OR locked_until <= ?) RETURNING failed_attempts`,
    args: [
      MAX_FAILURES,
      new Date(now.getTime() + LOCK_MINUTES * 60000).toISOString(),
      row.id,
      now.toISOString(),
    ],
  });
  if (!reserved.rows.length) throw locked;
  if (!(await verifyPassword(input.password, String(row.password_hash)))) throw denied;
  const token = randomBytes(32).toString("hex");
  const expires = new Date(now.getTime() + SESSION_DAYS * 86400000).toISOString();
  await db.batch(
    [
      {
        sql: "UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?",
        args: [row.id],
      },
      {
        sql: "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
        args: [tokenHash(token), row.id, expires],
      },
      // Abandoned sessions are cleared here, so the table cannot grow forever.
      { sql: "DELETE FROM sessions WHERE expires_at <= ?", args: [now.toISOString()] },
    ],
    "write",
  );
  const account: Account = {
    id: String(row.id),
    username: String(row.username),
    role: row.role as Role,
  };
  return { token, account };
}

export async function signOut(token?: string) {
  if (!token) return;
  const db = await database();
  await db.execute({ sql: "DELETE FROM sessions WHERE token_hash = ?", args: [tokenHash(token)] });
}

const toUser = (row: Record<string, unknown>): UserSummary => ({
  id: String(row.id),
  username: String(row.username),
  role: row.role as Role,
  createdAt: String(row.created_at),
});

export async function listUsers() {
  const db = await database();
  const result = await db.execute(
    "SELECT id, username, role, created_at FROM users ORDER BY role = 'admin' DESC, username ASC",
  );
  return result.rows.map(toUser);
}

export async function createUser(body: unknown) {
  const input = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const username = validateUsername(input.username);
  const passwordHash = await hashPassword(validatePassword(input.password));
  const user: UserSummary = {
    id: randomUUID(),
    username,
    role: "user",
    createdAt: new Date().toISOString(),
  };
  const db = await database();
  try {
    await db.execute({
      sql: "INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, 'user', ?)",
      args: [user.id, username, passwordHash, user.createdAt],
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed: users.username"))
      throw new ApiError(409, "That username is taken.");
    throw error;
  }
  return user;
}

// The admin is managed from the server environment, never through this API.
async function missingUser(id: string): Promise<never> {
  const db = await database();
  const result = await db.execute({ sql: "SELECT role FROM users WHERE id = ?", args: [id] });
  if (result.rows[0]?.role === "admin")
    throw new ApiError(403, "The admin account is set in the server environment.");
  throw new ApiError(404, "This user could not be found.");
}

export async function resetPassword(id: string, body: unknown) {
  const input = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const passwordHash = await hashPassword(validatePassword(input.password));
  const db = await database();
  const [update, , select] = await db.batch(
    [
      {
        sql: "UPDATE users SET password_hash = ?, failed_attempts = 0, locked_until = NULL WHERE id = ? AND role = 'user'",
        args: [passwordHash, id],
      },
      {
        sql: "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE id = ? AND role = 'user')",
        args: [id],
      },
      { sql: "SELECT id, username, role, created_at FROM users WHERE id = ?", args: [id] },
    ],
    "write",
  );
  if (!update.rowsAffected) return missingUser(id);
  return toUser(select.rows[0]);
}

export async function deleteUser(id: string) {
  const db = await database();
  const [, removed] = await db.batch(
    [
      {
        sql: "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE id = ? AND role = 'user')",
        args: [id],
      },
      { sql: "DELETE FROM users WHERE id = ? AND role = 'user'", args: [id] },
    ],
    "write",
  );
  if (!removed.rowsAffected) await missingUser(id);
}
