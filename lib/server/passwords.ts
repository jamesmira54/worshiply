import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { PASSWORD_MAX, PASSWORD_MIN, USERNAME_PATTERN } from "@/types/user";
import { ApiError } from "./validation";

const derive = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  length: number,
) => Promise<Buffer>;
const KEY_LENGTH = 64;

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

// Any stored value that is not a well-formed hash fails closed.
export async function verifyPassword(password: string, stored: string) {
  const match = /^scrypt\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(stored);
  if (!match) return false;
  const key = await derive(password, Buffer.from(match[1], "hex"), KEY_LENGTH);
  return timingSafeEqual(key, Buffer.from(match[2], "hex"));
}

export function normalizeUsername(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function validateUsername(value: unknown) {
  const username = normalizeUsername(value);
  if (!USERNAME_PATTERN.test(username))
    throw new ApiError(
      400,
      "Usernames are 3-40 characters: letters, numbers, dots, dashes, or underscores.",
    );
  return username;
}

export function validatePassword(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length < PASSWORD_MIN ||
    value.length > PASSWORD_MAX
  )
    throw new ApiError(
      400,
      `Passwords are ${PASSWORD_MIN}-${PASSWORD_MAX} characters.`,
    );
  return value;
}

// Only same-site paths are allowed after sign-in, never another origin.
// Resolving like a browser catches tricks such as "//", "/\\", or "/\t/", and
// rejecting a resolved "//" path catches dot segments such as "/..//host".
export function safeNext(value: unknown) {
  const base = "http://local.invalid";
  if (typeof value !== "string" || !value.startsWith("/")) return "/songs";
  try {
    const url = new URL(value, base);
    if (url.origin === base && !url.pathname.startsWith("//"))
      return url.pathname + url.search + url.hash;
  } catch {
    /* Unparseable values fall back below. */
  }
  return "/songs";
}
