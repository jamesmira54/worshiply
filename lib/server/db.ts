import "server-only";
import { createClient, type Client } from "@libsql/client";
import { mkdir } from "node:fs/promises";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { DEFAULT_CATEGORY } from "@/types/song";
import type { Song, SongInput } from "@/types/song";
import { ApiError } from "./validation";

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
  await db.execute({
    sql: "DELETE FROM songs WHERE slug = ? AND owner_hash = ?",
    args: [slug, ownerHash(token)],
  });
}
