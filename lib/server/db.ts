import "server-only";
import { createClient, type Client } from "@libsql/client";
import { mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { DEFAULT_CATEGORY } from "@/types/song";
import type { Song, SongInput } from "@/types/song";
import type { Lineup, LineupSummary, SlotKey, SlotValue } from "@/types/lineup";
import { SLOTS, sundaysInMonth } from "@/lib/lineups";
import { ApiError, validateSlotAssignment } from "./validation";
import { hashPassword, validatePassword, validateUsername, verifyPassword } from "./passwords";

let clientPromise: Promise<Client> | undefined;
export function database(): Promise<Client> {
  if (!clientPromise)
    clientPromise = initialize().catch((error) => {
      clientPromise = undefined;
      throw error;
    });
  return clientPromise;
}
async function initialize() {
  const configuredUrl = process.env.TURSO_DATABASE_URL?.trim();
  if (
    process.env.VERCEL === "1" &&
    (!configuredUrl || !/^(libsql|https):\/\//i.test(configuredUrl))
  ) {
    throw new ApiError(
      503,
      "Persistent song storage is not configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in Vercel, then redeploy.",
    );
  }
  const url = configuredUrl || "file:data/worshiply.db";
  if (url === "file:data/worshiply.db")
    await mkdir("data", { recursive: true });
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  await client.batch(
    [
      `CREATE TABLE IF NOT EXISTS songs (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, artist TEXT NOT NULL, original_key TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL, owner_hash TEXT NOT NULL)`,
      `CREATE INDEX IF NOT EXISTS songs_updated ON songs(updated_at DESC)`,
      `CREATE INDEX IF NOT EXISTS songs_key ON songs(original_key)`,
      `CREATE TABLE IF NOT EXISTS lineups (id TEXT PRIMARY KEY, owner_hash TEXT NOT NULL, month TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE (owner_hash, month))`,
      `CREATE TABLE IF NOT EXISTS lineup_slots (lineup_id TEXT NOT NULL REFERENCES lineups(id) ON DELETE CASCADE, sunday TEXT NOT NULL, slot TEXT NOT NULL, song_id TEXT NOT NULL, PRIMARY KEY (lineup_id, sunday, slot))`,
      `CREATE INDEX IF NOT EXISTS lineup_slots_song ON lineup_slots(song_id)`,
      // Lineups are shared now: keep only the newest lineup for each month.
      `DELETE FROM lineup_slots WHERE lineup_id IN (SELECT id FROM lineups l WHERE ${NEWER_LINEUP("l")})`,
      `DELETE FROM lineups WHERE ${NEWER_LINEUP("lineups")}`,
      `CREATE UNIQUE INDEX IF NOT EXISTS lineups_month ON lineups(month)`,
      `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('admin', 'user')), failed_attempts INTEGER NOT NULL DEFAULT 0, locked_until TEXT, created_at TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL)`,
      `CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id)`,
    ],
    "write",
  );
  await syncAdmin(client);
  return client;
}
const NEWER_LINEUP = (table: string) =>
  `EXISTS (SELECT 1 FROM lineups k WHERE k.month = ${table}.month AND (k.updated_at > ${table}.updated_at OR (k.updated_at = ${table}.updated_at AND k.id > ${table}.id)))`;

// ADMIN_USERNAME and ADMIN_PASSWORD define the one admin. Any other admin row
// (for example after a rename) is removed, so the environment stays the source of truth.
async function syncAdmin(client: Client) {
  let username = "";
  let password = "";
  try {
    username = validateUsername(process.env.ADMIN_USERNAME);
    password = validatePassword(process.env.ADMIN_PASSWORD);
  } catch {
    console.warn(
      "ADMIN_USERNAME or ADMIN_PASSWORD is missing or invalid. Admin sign-in is disabled.",
    );
    username = "";
  }
  const others = "SELECT id FROM users WHERE role = 'admin' AND username != ?";
  await client.batch(
    [
      { sql: `DELETE FROM sessions WHERE user_id IN (${others})`, args: [username] },
      { sql: "DELETE FROM users WHERE role = 'admin' AND username != ?", args: [username] },
    ],
    "write",
  );
  if (!username) return;
  const result = await client.execute({
    sql: "SELECT id, role, password_hash FROM users WHERE username = ?",
    args: [username],
  });
  const row = result.rows[0];
  if (!row) {
    await client.execute({
      sql: "INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, 'admin', ?)",
      args: [randomUUID(), username, await hashPassword(password), new Date().toISOString()],
    });
    return;
  }
  const current = await verifyPassword(password, String(row.password_hash));
  if (current && row.role === "admin") return;
  await client.batch(
    [
      {
        sql: "UPDATE users SET role = 'admin', password_hash = ?, failed_attempts = 0, locked_until = NULL WHERE id = ?",
        args: [current ? String(row.password_hash) : await hashPassword(password), row.id],
      },
      // A changed password or a promotion signs out existing sessions.
      { sql: "DELETE FROM sessions WHERE user_id = ?", args: [row.id] },
    ],
    "write",
  );
}

export async function listSongs(
  options: { search: string; key: string; category: string; sort: string; page: number },
  canEdit: boolean,
) {
  const db = await database();
  const conditions: string[] = [];
  const args: string[] = [];
  if (options.search) {
    conditions.push("(title LIKE ? ESCAPE '\\' OR artist LIKE ? ESCAPE '\\')");
    const query = `%${options.search.replace(/[\\%_]/g, "\\$&")}%`;
    args.push(query, query);
  }
  if (options.key) {
    conditions.push("json_extract(data, '$.defaultKey') = ?");
    args.push(options.key);
  }
  if (options.category) {
    conditions.push("COALESCE(json_extract(data, '$.category'), ?) = ?");
    args.push(DEFAULT_CATEGORY, options.category);
  }
  const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
  const order =
    options.sort === "title"
      ? "title COLLATE NOCASE ASC, id ASC"
      : "updated_at DESC, id ASC";
  const pageSize = 12;
  const [count, rows] = await db.batch(
    [
      { sql: `SELECT COUNT(*) AS total FROM songs${where}`, args },
      {
        sql: `SELECT data FROM songs${where} ORDER BY ${order} LIMIT ? OFFSET ?`,
        args: [...args, pageSize, (options.page - 1) * pageSize],
      },
    ],
    "read",
  );
  return {
    songs: rows.rows.map((row) => ({
      ...{ category: DEFAULT_CATEGORY, ...JSON.parse(String(row.data)) } as Song,
      canEdit,
    })),
    total: Number(count.rows[0].total),
    page: options.page,
    pageSize,
  };
}

export async function findSong(slug: string, canEdit: boolean) {
  const db = await database();
  const result = await db.execute({
    sql: "SELECT data FROM songs WHERE slug = ?",
    args: [slug],
  });
  const row = result.rows[0];
  if (!row) throw new ApiError(404, "This song could not be found.");
  return {
    song: { category: DEFAULT_CATEGORY, ...JSON.parse(String(row.data)) } as Song,
    canEdit,
  };
}

// owner_hash is a legacy NOT NULL column from cookie ownership; new rows leave it empty.
export async function createSong(input: SongInput) {
  const db = await database();
  const id = randomUUID();
  const titleSlug =
    input.title
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 65) || "untitled-song";
  const base = titleSlug === "new" ? "new-song" : titleSlug;
  const now = new Date().toISOString();
  for (let attempt = 0; attempt < 100; attempt++) {
    const song: Song = {
      ...input,
      id,
      slug: attempt === 0 ? base : `${base}-${attempt + 1}`,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await db.execute({
        sql: "INSERT INTO songs (id, slug, title, artist, original_key, updated_at, data, owner_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        args: [
          id,
          song.slug,
          song.title,
          song.artist,
          song.originalKey,
          now,
          JSON.stringify(song),
          "",
        ],
      });
      return song;
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !error.message.includes("UNIQUE constraint failed: songs.slug")
      )
        throw error;
    }
  }
  throw new ApiError(503, "We could not create the song. Please try again.");
}

export async function updateSong(slug: string, input: SongInput) {
  const current = await findSong(slug, true);
  const song: Song = {
    ...current.song,
    ...input,
    updatedAt: new Date().toISOString(),
  };
  const db = await database();
  const result = await db.execute({
    sql: "UPDATE songs SET title = ?, artist = ?, original_key = ?, updated_at = ?, data = ? WHERE slug = ?",
    args: [
      song.title,
      song.artist,
      song.originalKey,
      song.updatedAt,
      JSON.stringify(song),
      slug,
    ],
  });
  if (!result.rowsAffected)
    throw new ApiError(404, "This song could not be found.");
  return song;
}

export async function deleteSong(slug: string) {
  await findSong(slug, true);
  const db = await database();
  const result = await db.execute({
    sql: `DELETE FROM songs WHERE slug = ?
      AND NOT EXISTS (SELECT 1 FROM lineup_slots s WHERE s.song_id = songs.id)`,
    args: [slug],
  });
  if (!result.rowsAffected)
    throw new ApiError(
      409,
      "This song is in a monthly lineup. Remove it from the lineup first.",
    );
}

const CATEGORY_SQL = "COALESCE(json_extract(data, '$.category'), ?)";

// owner_hash is a legacy NOT NULL column; lineups are now one shared lineup per month.
export async function createLineup(month: string) {
  const db = await database();
  const now = new Date().toISOString();
  const [insert, select] = await db.batch(
    [
      {
        sql: "INSERT INTO lineups (id, owner_hash, month, created_at, updated_at) VALUES (?, '', ?, ?, ?) ON CONFLICT (month) DO NOTHING",
        args: [randomUUID(), month, now, now],
      },
      {
        sql: "SELECT id, month FROM lineups WHERE month = ?",
        args: [month],
      },
    ],
    "write",
  );
  const row = select.rows[0];
  return {
    lineup: { id: String(row.id), month: String(row.month) },
    created: insert.rowsAffected > 0,
  };
}

export async function listLineups(): Promise<LineupSummary[]> {
  const db = await database();
  const result = await db.execute(
    "SELECT id, month, updated_at FROM lineups ORDER BY month DESC",
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    month: String(row.month),
    updatedAt: String(row.updated_at),
  }));
}

async function lineupAccess(id: string) {
  const db = await database();
  const result = await db.execute({
    sql: "SELECT month, updated_at FROM lineups WHERE id = ?",
    args: [id],
  });
  const row = result.rows[0];
  if (!row) throw new ApiError(404, "This lineup could not be found.");
  return {
    db,
    month: String(row.month),
    updatedAt: String(row.updated_at),
  };
}

export async function findLineup(
  id: string,
  canEdit: boolean,
): Promise<{ lineup: Lineup; canEdit: boolean }> {
  const { db, month, updatedAt } = await lineupAccess(id);
  const slots = await db.execute({
    sql: "SELECT s.sunday, s.slot, songs.data FROM lineup_slots s LEFT JOIN songs ON songs.id = s.song_id WHERE s.lineup_id = ?",
    args: [id],
  });
  const sundays = sundaysInMonth(month).map((date) => ({
    date,
    slots: Object.fromEntries(SLOTS.map((slot) => [slot.key, null])) as Record<
      SlotKey,
      SlotValue
    >,
  }));
  for (const row of slots.rows) {
    const sunday = sundays.find((item) => item.date === row.sunday);
    const key = row.slot as SlotKey;
    if (!sunday || !(key in sunday.slots)) continue;
    if (row.data === null) {
      sunday.slots[key] = { removed: true };
      continue;
    }
    const song = { category: DEFAULT_CATEGORY, ...JSON.parse(String(row.data)) } as Song;
    sunday.slots[key] = {
      id: song.id,
      slug: song.slug,
      title: song.title,
      artist: song.artist,
      category: song.category,
      defaultKey: song.defaultKey,
    };
  }
  return { lineup: { id, month, updatedAt, sundays }, canEdit };
}

export async function assignSlot(id: string, body: unknown) {
  const { db, month } = await lineupAccess(id);
  const { sunday, slot, songId } = validateSlotAssignment(body, month);
  const exists = "EXISTS (SELECT 1 FROM lineups WHERE id = ?)";
  if (songId === null) {
    await db.execute({
      sql: "DELETE FROM lineup_slots WHERE lineup_id = ? AND sunday = ? AND slot = ?",
      args: [id, sunday, slot],
    });
  } else {
    const category = SLOTS.find((item) => item.key === slot)!.category;
    const result = await db.execute({
      sql: `INSERT INTO lineup_slots (lineup_id, sunday, slot, song_id)
        SELECT ?, ?, ?, ? WHERE ${exists}
          AND EXISTS (SELECT 1 FROM songs WHERE id = ?${category ? ` AND ${CATEGORY_SQL} = ?` : ""})
        ON CONFLICT (lineup_id, sunday, slot) DO UPDATE SET song_id = excluded.song_id`,
      args: [
        id,
        sunday,
        slot,
        songId,
        id,
        songId,
        ...(category ? [DEFAULT_CATEGORY, category] : []),
      ],
    });
    if (!result.rowsAffected) {
      const [lineup, song] = await db.batch(
        [
          { sql: `SELECT ${exists} AS present`, args: [id] },
          { sql: "SELECT 1 FROM songs WHERE id = ?", args: [songId] },
        ],
        "read",
      );
      if (!lineup.rows[0].present)
        throw new ApiError(404, "This lineup could not be found.");
      if (!song.rows.length)
        throw new ApiError(404, "That song could not be found.");
      throw new ApiError(400, `Choose a ${category} song for this slot.`);
    }
  }
  await db.execute({
    sql: "UPDATE lineups SET updated_at = ? WHERE id = ?",
    args: [new Date().toISOString(), id],
  });
  return findLineup(id, true);
}

export async function deleteLineup(id: string) {
  const { db } = await lineupAccess(id);
  await db.batch(
    [
      { sql: "DELETE FROM lineup_slots WHERE lineup_id = ?", args: [id] },
      { sql: "DELETE FROM lineups WHERE id = ?", args: [id] },
    ],
    "write",
  );
}
