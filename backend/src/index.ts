import { Hono } from "hono";
import { cors } from "hono/cors";
import { nanoid } from "nanoid";
export { CollabRoom } from "./room";

export type Bindings = {
  DB: D1Database;
  ROOMS: DurableObjectNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS for frontend clients (e.g. DrawDB local dev or production)
app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 86400,
  }),
);

// Health check endpoint
app.get("/", (c) => {
  return c.json({
    status: "ok",
    service: "drawdb-backend",
    runtime: "Cloudflare Workers",
    storage: "Cloudflare D1",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

// Create a new gist / share diagram
app.post("/gists", async (c) => {
  try {
    const body = await c.req.json<{
      public?: boolean;
      filename: string;
      description?: string;
      content: string;
    }>();

    const { filename, content, description = "drawDB diagram", public: isPublic = false } = body;

    if (!filename || content === undefined) {
      return c.json({ error: "filename and content are required" }, 400);
    }

    const gistId = nanoid(12);
    const now = new Date().toISOString();
    const sha = crypto.randomUUID().replace(/-/g, "").slice(0, 20);

    const db = c.env.DB;

    await db.batch([
      db
        .prepare(
          "INSERT INTO gists (id, description, is_public, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(gistId, description, isPublic ? 1 : 0, now, now),
      db
        .prepare(
          "INSERT INTO gist_files (gist_id, filename, content, updated_at) VALUES (?, ?, ?, ?)",
        )
        .bind(gistId, filename, content, now),
      db
        .prepare(
          "INSERT INTO gist_versions (gist_id, sha, filename, content, committed_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(gistId, sha, filename, content, now),
    ]);

    return c.json(
      {
        data: {
          id: gistId,
        },
      },
      201,
    );
  } catch (err: any) {
    console.error("Failed to create gist:", err);
    return c.json({ error: "Internal Server Error", message: err?.message }, 500);
  }
});

// Get a gist by ID (used when opening shared link: /editor?shareId=...)
app.get("/gists/:id", async (c) => {
  try {
    const gistId = c.req.param("id");
    const db = c.env.DB;

    const gist = await db
      .prepare("SELECT * FROM gists WHERE id = ?")
      .bind(gistId)
      .first<{
        id: string;
        description: string;
        is_public: number;
        created_at: string;
        updated_at: string;
      }>();

    if (!gist) {
      return c.json({ error: "Gist not found" }, 404);
    }

    const { results: files } = await db
      .prepare("SELECT filename, content FROM gist_files WHERE gist_id = ?")
      .bind(gistId)
      .all<{ filename: string; content: string }>();

    const filesMap: Record<string, { filename: string; content: string }> = {};
    for (const file of files || []) {
      filesMap[file.filename] = {
        filename: file.filename,
        content: file.content,
      };
    }

    return c.json({
      data: {
        id: gist.id,
        description: gist.description,
        public: Boolean(gist.is_public),
        created_at: gist.created_at,
        updated_at: gist.updated_at,
        files: filesMap,
      },
    });
  } catch (err: any) {
    console.error("Failed to get gist:", err);
    return c.json({ error: "Internal Server Error", message: err?.message }, 500);
  }
});

// Update or delete file in a gist (used for syncing or unsharing)
app.patch("/gists/:id", async (c) => {
  try {
    const gistId = c.req.param("id");
    const body = await c.req.json<{
      filename: string;
      content?: string | null;
    }>();

    const { filename, content } = body;
    const db = c.env.DB;
    const now = new Date().toISOString();

    const gist = await db
      .prepare("SELECT id FROM gists WHERE id = ?")
      .bind(gistId)
      .first();

    if (!gist) {
      return c.json({ error: "Gist not found" }, 404);
    }

    // If content is omitted or null, delete the file (unshare)
    if (content === undefined || content === null) {
      await db.batch([
        db
          .prepare("DELETE FROM gist_files WHERE gist_id = ? AND filename = ?")
          .bind(gistId, filename),
        db
          .prepare("UPDATE gists SET updated_at = ? WHERE id = ?")
          .bind(now, gistId),
      ]);

      return c.json({ deleted: true });
    }

    // Check previous content to avoid redundant version records
    const previous = await db
      .prepare("SELECT content FROM gist_files WHERE gist_id = ? AND filename = ?")
      .bind(gistId, filename)
      .first<{ content: string }>();

    const sha = crypto.randomUUID().replace(/-/g, "").slice(0, 20);

    const statements = [
      db
        .prepare(
          `INSERT INTO gist_files (gist_id, filename, content, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(gist_id, filename) DO UPDATE SET
             content = excluded.content,
             updated_at = excluded.updated_at`,
        )
        .bind(gistId, filename, content, now),
      db
        .prepare("UPDATE gists SET updated_at = ? WHERE id = ?")
        .bind(now, gistId),
    ];

    if (!previous || previous.content !== content) {
      statements.push(
        db
          .prepare(
            "INSERT INTO gist_versions (gist_id, sha, filename, content, committed_at) VALUES (?, ?, ?, ?, ?)",
          )
          .bind(gistId, sha, filename, content, now),
      );
    }

    await db.batch(statements);

    return c.json({ deleted: false });
  } catch (err: any) {
    console.error("Failed to patch gist:", err);
    return c.json({ error: "Internal Server Error", message: err?.message }, 500);
  }
});

// Delete a gist
app.delete("/gists/:id", async (c) => {
  try {
    const gistId = c.req.param("id");
    const db = c.env.DB;

    await db.batch([
      db.prepare("DELETE FROM gist_versions WHERE gist_id = ?").bind(gistId),
      db.prepare("DELETE FROM gist_files WHERE gist_id = ?").bind(gistId),
      db.prepare("DELETE FROM gists WHERE id = ?").bind(gistId),
    ]);

    return c.json({ success: true });
  } catch (err: any) {
    console.error("Failed to delete gist:", err);
    return c.json({ error: "Internal Server Error", message: err?.message }, 500);
  }
});

// Get commit/version history for a file (used by Versions.jsx)
app.get("/gists/:id/file-versions/:file", async (c) => {
  try {
    const gistId = c.req.param("id");
    const filename = c.req.param("file");
    const limitParam = c.req.query("limit");
    const cursorParam = c.req.query("cursor");

    const limit = Math.min(Math.max(parseInt(limitParam || "10", 10), 1), 50);
    const db = c.env.DB;

    let query =
      "SELECT id, sha, committed_at FROM gist_versions WHERE gist_id = ? AND filename = ?";
    const binds: any[] = [gistId, filename];

    if (cursorParam) {
      query += " AND id < ?";
      binds.push(parseInt(cursorParam, 10));
    }

    query += " ORDER BY id DESC LIMIT ?";
    binds.push(limit + 1);

    const { results } = await db
      .prepare(query)
      .bind(...binds)
      .all<{ id: number; sha: string; committed_at: string }>();

    const rows = results || [];
    const hasMore = rows.length > limit;
    const dataRows = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = dataRows.length > 0 ? String(dataRows[dataRows.length - 1].id) : null;

    return c.json({
      data: dataRows.map((r) => ({
        version: r.sha,
        committed_at: r.committed_at,
        change_status: {
          total: 0,
          additions: 0,
          deletions: 0,
        },
      })),
      pagination: {
        cursor: hasMore ? nextCursor : null,
        hasMore,
      },
    });
  } catch (err: any) {
    console.error("Failed to list file versions:", err);
    return c.json({ error: "Internal Server Error", message: err?.message }, 500);
  }
});

// Get a specific version of a gist (used by Versions.jsx)
app.get("/gists/:id/:sha", async (c) => {
  try {
    const gistId = c.req.param("id");
    const sha = c.req.param("sha");
    const db = c.env.DB;

    const row = await db
      .prepare(
        "SELECT filename, content FROM gist_versions WHERE gist_id = ? AND sha = ?",
      )
      .bind(gistId, sha)
      .first<{ filename: string; content: string }>();

    if (!row) {
      return c.json({ error: "Version not found" }, 404);
    }

    return c.json({
      data: {
        files: {
          [row.filename]: {
            filename: row.filename,
            content: row.content,
          },
        },
      },
    });
  } catch (err: any) {
    console.error("Failed to get version:", err);
    return c.json({ error: "Internal Server Error", message: err?.message }, 500);
  }
});

// Compare two versions (used by Migration.jsx)
app.get("/gists/:id/file/:file/compare/:versionA/:versionB", async (c) => {
  try {
    const gistId = c.req.param("id");
    const filename = c.req.param("file");
    const versionA = c.req.param("versionA");
    const versionB = c.req.param("versionB");
    const db = c.env.DB;

    const [rowA, rowB] = await Promise.all([
      db
        .prepare(
          "SELECT content FROM gist_versions WHERE gist_id = ? AND filename = ? AND sha = ?",
        )
        .bind(gistId, filename, versionA)
        .first<{ content: string }>(),
      db
        .prepare(
          "SELECT content FROM gist_versions WHERE gist_id = ? AND filename = ? AND sha = ?",
        )
        .bind(gistId, filename, versionB)
        .first<{ content: string }>(),
    ]);

    return c.json({
      data: {
        contentA: rowA?.content || "",
        contentB: rowB?.content || "",
      },
    });
  } catch (err: any) {
    console.error("Failed to compare versions:", err);
    return c.json({ error: "Internal Server Error", message: err?.message }, 500);
  }
});

// Optional email endpoint stub
app.post("/email/send", async (c) => {
  return c.json({ success: true, message: "Email endpoint stubbed" });
});

// Real-time Collaboration: WebSocket endpoint for Room
app.all("/rooms/:roomId/websocket", async (c) => {
  const roomId = c.req.param("roomId");
  const id = c.env.ROOMS.idFromName(roomId);
  const room = c.env.ROOMS.get(id);
  return room.fetch(c.req.raw);
});

// Real-time Collaboration: HTTP endpoint for Room snapshot / state
app.all("/rooms/:roomId", async (c) => {
  const roomId = c.req.param("roomId");
  const id = c.env.ROOMS.idFromName(roomId);
  const room = c.env.ROOMS.get(id);
  return room.fetch(c.req.raw);
});

export default app;
