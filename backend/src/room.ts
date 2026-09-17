export type UserPresence = {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number } | null;
  linking?: any;
  viewOnly?: boolean;
};

export type CommentReply = {
  id: string;
  author: {
    id: string;
    name: string;
    color: string;
  };
  text: string;
  createdAt: string;
};

export type DiagramComment = {
  id: string;
  x: number;
  y: number;
  author: {
    id: string;
    name: string;
    color: string;
  };
  text: string;
  createdAt: string;
  resolved?: boolean;
  replies?: CommentReply[];
};

export type DiagramState = {
  title?: string;
  database?: string;
  tables?: any[];
  relationships?: any[];
  notes?: any[];
  subjectAreas?: any[];
  types?: any[];
  enums?: any[];
  customTypes?: any;
};

export class CollabRoom {
  state: DurableObjectState;
  env: any;
  sessions: Map<WebSocket, UserPresence> = new Map();
  comments: DiagramComment[] = [];
  diagramState: DiagramState = {
    title: "Untitled Diagram",
    database: "generic",
    tables: [],
    relationships: [],
    notes: [],
    subjectAreas: [],
    types: [],
    enums: [],
  };
  saveTimeout: any = null;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;

    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<DiagramState>("diagramState");
      if (stored) {
        this.diagramState = stored;
      }
      const storedComments = await this.state.storage.get<DiagramComment[]>("comments");
      if (storedComments) {
        this.comments = storedComments;
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      const userId = url.searchParams.get("userId") || crypto.randomUUID().slice(0, 8);
      const name = url.searchParams.get("name") || `User ${userId.slice(0, 4)}`;
      const color = url.searchParams.get("color") || "#1890ff";
      const viewOnly =
        url.searchParams.get("viewOnly") === "1" ||
        url.searchParams.get("viewOnly") === "true";

      const user: UserPresence = { id: userId, name, color, cursor: null, viewOnly };

      this.handleWebSocket(server, user);

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    // HTTP GET snapshot of room
    if (request.method === "GET") {
      return Response.json({
        diagram: this.diagramState,
        comments: this.comments,
        users: Array.from(this.sessions.values()),
      });
    }

    // HTTP POST initial diagram
    if (request.method === "POST") {
      try {
        const body = (await request.json()) as DiagramState;
        this.diagramState = { ...this.diagramState, ...body };
        await this.state.storage.put("diagramState", this.diagramState);
        this.broadcast({
          type: "full_sync",
          diagram: this.diagramState,
        });
        return Response.json({ success: true });
      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 400 });
      }
    }

    return new Response("Not found", { status: 404 });
  }

  handleWebSocket(ws: WebSocket, user: UserPresence) {
    ws.accept();
    this.sessions.set(ws, user);

    // Send init packet to new client
    const initPayload = {
      type: "init",
      user,
      diagram: this.diagramState,
      comments: this.comments,
      users: Array.from(this.sessions.values()),
    };
    ws.send(JSON.stringify(initPayload));

    // Notify others that a new user joined
    this.broadcast(
      {
        type: "user_joined",
        user,
      },
      ws,
    );

    ws.addEventListener("message", (msg) => {
      try {
        const data = JSON.parse(msg.data as string);

        if (data.type === "cursor") {
          user.cursor = { x: data.x, y: data.y };
          this.broadcast(
            {
              type: "cursor",
              userId: user.id,
              x: data.x,
              y: data.y,
            },
            ws,
          );
        } else if (data.type === "viewport") {
          this.broadcast(
            {
              type: "viewport",
              userId: user.id,
              pan: data.pan,
              zoom: data.zoom,
            },
            ws,
          );
        } else if (data.type === "awareness") {
          if (data.linking !== undefined) {
            user.linking = data.linking;
          }
          this.broadcast(
            {
              type: "awareness",
              userId: user.id,
              data: data.data || data,
            },
            ws,
          );
        } else if (data.type === "delta") {
          if (user.viewOnly) return;
          this.applyDelta(data.delta);
          this.broadcast(
            {
              type: "delta",
              delta: data.delta,
              from: user.id,
            },
            ws,
          );
          this.scheduleSave();
        } else if (data.type === "set_state") {
          if (user.viewOnly) return;
          this.diagramState = { ...this.diagramState, ...data.state };
          this.broadcast(
            {
              type: "full_sync",
              diagram: this.diagramState,
              from: user.id,
            },
            ws,
          );
          this.scheduleSave();
        } else if (data.type === "add_comment") {
          const newComment: DiagramComment = data.comment;
          if (newComment && newComment.id) {
            this.comments.push(newComment);
            this.state.storage.put("comments", this.comments);
            this.broadcast({
              type: "comment_added",
              comment: newComment,
            });
          }
        } else if (data.type === "reply_comment") {
          const { commentId, reply } = data;
          const target = this.comments.find((c) => c.id === commentId);
          if (target) {
            target.replies = target.replies || [];
            target.replies.push(reply);
            this.state.storage.put("comments", this.comments);
            this.broadcast({
              type: "comment_replied",
              commentId,
              reply,
            });
          }
        } else if (data.type === "resolve_comment") {
          const { commentId, resolved } = data;
          const target = this.comments.find((c) => c.id === commentId);
          if (target) {
            target.resolved = Boolean(resolved);
            this.state.storage.put("comments", this.comments);
            this.broadcast({
              type: "comment_resolved",
              commentId,
              resolved: target.resolved,
            });
          }
        } else if (data.type === "delete_comment") {
          const { commentId } = data;
          this.comments = this.comments.filter((c) => c.id !== commentId);
          this.state.storage.put("comments", this.comments);
          this.broadcast({
            type: "comment_deleted",
            commentId,
          });
        }
      } catch (err) {
        console.error("Error processing websocket message:", err);
      }
    });

    const closeHandler = () => {
      this.sessions.delete(ws);
      this.broadcast({
        type: "user_left",
        userId: user.id,
      });
    };

    ws.addEventListener("close", closeHandler);
    ws.addEventListener("error", closeHandler);
  }

  broadcast(message: any, excludeWs?: WebSocket) {
    const raw = JSON.stringify(message);
    for (const [socket] of this.sessions.entries()) {
      if (socket !== excludeWs) {
        try {
          socket.send(raw);
        } catch {
          // Socket might be dead, remove it
          this.sessions.delete(socket);
        }
      }
    }
  }

  applyDelta(delta: { target: string; action: string; entityId: string; data: any[] }) {
    if (!delta || !delta.target || !delta.action) return;

    const { target, action, data } = delta;

    switch (target) {
      case "table": {
        const tables = this.diagramState.tables || [];
        if (action === "create") {
          const newTable = data[0];
          if (!tables.some((t) => t.id === newTable.id)) {
            this.diagramState.tables = [...tables, newTable];
          }
        } else if (action === "update") {
          const [id, updatedValues] = data;
          this.diagramState.tables = tables.map((t) =>
            t.id === id ? { ...t, ...updatedValues } : t,
          );
        } else if (action === "delete") {
          const [id] = data;
          this.diagramState.tables = tables.filter((t) => t.id !== id);
          if (this.diagramState.relationships) {
            this.diagramState.relationships = this.diagramState.relationships.filter(
              (r) => !(r.startTableId === id || r.endTableId === id),
            );
          }
        }
        break;
      }

      case "relationship": {
        const rels = this.diagramState.relationships || [];
        if (action === "create") {
          const newRel = data[0];
          if (!rels.some((r) => r.id === newRel.id)) {
            this.diagramState.relationships = [...rels, newRel];
          }
        } else if (action === "update") {
          const [id, updatedValues] = data;
          this.diagramState.relationships = rels.map((r) =>
            r.id === id ? { ...r, ...updatedValues } : r,
          );
        } else if (action === "delete") {
          const [id] = data;
          this.diagramState.relationships = rels.filter((r) => r.id !== id);
        }
        break;
      }

      case "note": {
        const notes = this.diagramState.notes || [];
        if (action === "create") {
          const newNote = data[0];
          if (!notes.some((n) => n.id === newNote.id)) {
            this.diagramState.notes = [...notes, newNote];
          }
        } else if (action === "update") {
          const [id, updatedValues] = data;
          this.diagramState.notes = notes.map((n) =>
            n.id === id ? { ...n, ...updatedValues } : n,
          );
        } else if (action === "delete") {
          const [id] = data;
          this.diagramState.notes = notes.filter((n) => n.id !== id);
        }
        break;
      }

      case "area": {
        const areas = this.diagramState.subjectAreas || [];
        if (action === "create") {
          const newArea = data[0];
          if (!areas.some((a) => a.id === newArea.id)) {
            this.diagramState.subjectAreas = [...areas, newArea];
          }
        } else if (action === "update") {
          const [id, updatedValues] = data;
          this.diagramState.subjectAreas = areas.map((a) =>
            a.id === id ? { ...a, ...updatedValues } : a,
          );
        } else if (action === "delete") {
          const [id] = data;
          this.diagramState.subjectAreas = areas.filter((a) => a.id !== id);
        }
        break;
      }

      case "database": {
        if (action === "update") {
          this.diagramState.database = data[0];
        }
        break;
      }

      case "type": {
        const types = this.diagramState.types || [];
        if (action === "create") {
          this.diagramState.types = [...types, data[0]];
        } else if (action === "update") {
          const [id, updatedValues] = data;
          this.diagramState.types = types.map((t) =>
            t.id === id ? { ...t, ...updatedValues } : t,
          );
        } else if (action === "delete") {
          this.diagramState.types = types.filter((t) => t.id !== data[0]);
        }
        break;
      }

      case "enum": {
        const enums = this.diagramState.enums || [];
        if (action === "create") {
          this.diagramState.enums = [...enums, data[0]];
        } else if (action === "update") {
          const [id, updatedValues] = data;
          this.diagramState.enums = enums.map((e) =>
            e.id === id ? { ...e, ...updatedValues } : e,
          );
        } else if (action === "delete") {
          this.diagramState.enums = enums.filter((e) => e.id !== data[0]);
        }
        break;
      }
    }
  }

  scheduleSave() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(async () => {
      await this.state.storage.put("diagramState", this.diagramState);
    }, 1000);
  }
}
