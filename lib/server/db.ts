import "server-only";
import { createClient, type Client } from "@libsql/client";
import { mkdir } from "node:fs/promises";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { DEFAULT_CATEGORY } from "@/types/song";
import type { Song, SongInput } from "@/types/song";
import type { Lineup, LineupSummary, SlotKey, SlotValue } from "@/types/lineup";
import { SLOTS, sundaysInMonth } from "@/lib/lineups";
import { ApiError, validateSlotAssignment } from "./validation";

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
    ],
    "write",
  );
  return client;
}
export const ownerHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const newOwnerToken = () => randomBytes(32).toString("hex");

export async function listSongs(
  options: { search: string; key: string; category: string; sort: string; page: number },
  token?: string,
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
        sql: `SELECT data, owner_hash FROM songs${where} ORDER BY ${order} LIMIT ? OFFSET ?`,
        args: [...args, pageSize, (options.page - 1) * pageSize],
      },
    ],
    "read",
  );
  const hash = token ? ownerHash(token) : null;
  return {
    songs: rows.rows.map((row) => ({
      ...{ category: DEFAULT_CATEGORY, ...JSON.parse(String(row.data)) } as Song,
      canEdit: row.owner_hash === hash,
    })),
    total: Number(count.rows[0].total),
    page: options.page,
    pageSize,
  };
}

export async function findSong(slug: string, token?: string) {
  const db = await database();
  const result = await db.execute({
    sql: "SELECT data, owner_hash FROM songs WHERE slug = ?",
    args: [slug],
  });
  const row = result.rows[0];
  if (!row) throw new ApiError(404, "This song could not be found.");
  return {
    song: { category: DEFAULT_CATEGORY, ...JSON.parse(String(row.data)) } as Song,
    canEdit: !!token && row.owner_hash === ownerHash(token),
  };
}

export async function createSong(input: SongInput, token: string) {
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
          ownerHash(token),
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

export async function updateSong(
  slug: string,
  input: SongInput,
  token?: string,
) {
  const current = await findSong(slug, token);
  if (!current.canEdit || !token)
    throw new ApiError(
      403,
      "Only the browser that created this song can edit it. Make a copy to create your own version.",
    );
  const song: Song = {
    ...current.song,
    ...input,
    updatedAt: new Date().toISOString(),
  };
  const db = await database();
  const result = await db.execute({
    sql: "UPDATE songs SET title = ?, artist = ?, original_key = ?, updated_at = ?, data = ? WHERE slug = ? AND owner_hash = ?",
    args: [
      song.title,
      song.artist,
      song.originalKey,
      song.updatedAt,
      JSON.stringify(song),
      slug,
      ownerHash(token),
    ],
  });
  if (!result.rowsAffected)
    throw new ApiError(404, "This song could not be found.");
  return song;
}

export async function deleteSong(slug: string, token?: string) {
  const current = await findSong(slug, token);
  if (!current.canEdit || !token)
    throw new ApiError(
      403,
      "Only the browser that created this song can delete it.",
    );
  const db = await database();
  const hash = ownerHash(token);
  const result = await db.execute({
    sql: `DELETE FROM songs WHERE slug = ? AND owner_hash = ?
      AND NOT EXISTS (SELECT 1 FROM lineup_slots s JOIN lineups l ON l.id = s.lineup_id
        WHERE s.song_id = songs.id AND l.owner_hash = ?)`,
    args: [slug, hash, hash],
  });
  if (!result.rowsAffected)
    throw new ApiError(
      409,
      "This song is in one of your monthly lineups. Remove it from the lineup first.",
    );
}

const CATEGORY_SQL = "COALESCE(json_extract(data, '$.category'), ?)";

export async function createLineup(month: string, token: string) {
  const db = await database();
  const hash = ownerHash(token);
  const now = new Date().toISOString();
  const [insert, select] = await db.batch(
    [
      {
        sql: "INSERT INTO lineups (id, owner_hash, month, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (owner_hash, month) DO NOTHING",
        args: [randomUUID(), hash, month, now, now],
      },
      {
        sql: "SELECT id, month FROM lineups WHERE owner_hash = ? AND month = ?",
        args: [hash, month],
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

export async function listLineups(token?: string): Promise<LineupSummary[]> {
  if (!token) return [];
  const db = await database();
  const result = await db.execute({
    sql: "SELECT id, month, updated_at FROM lineups WHERE owner_hash = ? ORDER BY month DESC",
    args: [ownerHash(token)],
  });
  return result.rows.map((row) => ({
    id: String(row.id),
    month: String(row.month),
    updatedAt: String(row.updated_at),
  }));
}

async function lineupAccess(id: string, token?: string) {
  const db = await database();
  const result = await db.execute({
    sql: "SELECT month, updated_at, owner_hash FROM lineups WHERE id = ?",
    args: [id],
  });
  const row = result.rows[0];
  if (!row) throw new ApiError(404, "This lineup could not be found.");
  return {
    db,
    month: String(row.month),
    updatedAt: String(row.updated_at),
    canEdit: !!token && row.owner_hash === ownerHash(token),
  };
}

function requireOwner(canEdit: boolean, token?: string): asserts token is string {
  if (!canEdit || !token)
    throw new ApiError(403, "Only the browser that created this lineup can change it.");
}

export async function findLineup(
  id: string,
  token?: string,
): Promise<{ lineup: Lineup; canEdit: boolean }> {
  const { db, month, updatedAt, canEdit } = await lineupAccess(id, token);
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

export async function assignSlot(id: string, body: unknown, token?: string) {
  const { db, month, canEdit } = await lineupAccess(id, token);
  requireOwner(canEdit, token);
  const { sunday, slot, songId } = validateSlotAssignment(body, month);
  const hash = ownerHash(token);
  const owned = "EXISTS (SELECT 1 FROM lineups WHERE id = ? AND owner_hash = ?)";
  if (songId === null) {
    await db.execute({
      sql: `DELETE FROM lineup_slots WHERE lineup_id = ? AND sunday = ? AND slot = ? AND ${owned}`,
      args: [id, sunday, slot, id, hash],
    });
  } else {
    const category = SLOTS.find((item) => item.key === slot)!.category;
    const result = await db.execute({
      sql: `INSERT INTO lineup_slots (lineup_id, sunday, slot, song_id)
        SELECT ?, ?, ?, ? WHERE ${owned}
          AND EXISTS (SELECT 1 FROM songs WHERE id = ?${category ? ` AND ${CATEGORY_SQL} = ?` : ""})
        ON CONFLICT (lineup_id, sunday, slot) DO UPDATE SET song_id = excluded.song_id`,
      args: [
        id,
        sunday,
        slot,
        songId,
        id,
        hash,
        songId,
        ...(category ? [DEFAULT_CATEGORY, category] : []),
      ],
    });
    if (!result.rowsAffected) {
      const [lineup, song] = await db.batch(
        [
          { sql: `SELECT ${owned} AS owned`, args: [id, hash] },
          { sql: "SELECT 1 FROM songs WHERE id = ?", args: [songId] },
        ],
        "read",
      );
      if (!lineup.rows[0].owned)
        throw new ApiError(404, "This lineup could not be found.");
      if (!song.rows.length)
        throw new ApiError(404, "That song could not be found.");
      throw new ApiError(400, `Choose a ${category} song for this slot.`);
    }
  }
  await db.execute({
    sql: "UPDATE lineups SET updated_at = ? WHERE id = ? AND owner_hash = ?",
    args: [new Date().toISOString(), id, hash],
  });
  return findLineup(id, token);
}

export async function deleteLineup(id: string, token?: string) {
  const { db, canEdit } = await lineupAccess(id, token);
  requireOwner(canEdit, token);
  const hash = ownerHash(token);
  await db.batch(
    [
      {
        sql: "DELETE FROM lineup_slots WHERE lineup_id IN (SELECT id FROM lineups WHERE id = ? AND owner_hash = ?)",
        args: [id, hash],
      },
      { sql: "DELETE FROM lineups WHERE id = ? AND owner_hash = ?", args: [id, hash] },
    ],
    "write",
  );
}
