export type Role = "admin" | "user";
export type Account = { id: string; username: string; role: Role };
export type UserSummary = Account & { createdAt: string };

export const USERNAME_PATTERN = /^[a-z0-9._-]{3,40}$/;
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 200;
