import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getCollabUser, saveCollabUser } from "../utils/collabUser";
import { nanoid } from "nanoid";

export const CollabContext = createContext({
  collabId: null,
  isCollabActive: false,
  isConnected: false,
  peers: [],
  currentUser: null,
  isViewOnly: false,
  followingUserId: null,
  followUser: () => {},
  unfollowUser: () => {},
  emitViewport: () => {},
  registerViewportHandler: () => {},
  comments: [],
  isCommentMode: false,
  setIsCommentMode: () => {},
  addComment: () => {},
  replyComment: () => {},
  resolveComment: () => {},
  deleteComment: () => {},
  updateUserName: () => {},
  emitDelta: () => {},
  emitAwareness: () => {},
  emitCursor: () => {},
  isApplyingRemoteRef: { current: false },
  registerRemoteApplier: () => {},
  startCollabSession: async () => {},
  leaveCollabSession: () => {},
});

function getCollabParamsFromUrl() {
  if (typeof window === "undefined") return { collabId: null, viewOnly: false };

  let collabId = null;
  let viewOnly = false;

  if (window.location.hash.includes("?")) {
    const qs = window.location.hash.slice(window.location.hash.indexOf("?"));
    const sp = new URLSearchParams(qs);
    collabId = sp.get("collabId");
    viewOnly = sp.get("viewOnly") === "1" || sp.get("viewOnly") === "true";
  }

  if (!collabId) {
    const sp = new URLSearchParams(window.location.search);
    collabId = sp.get("collabId");
    if (sp.get("viewOnly") === "1" || sp.get("viewOnly") === "true") {
      viewOnly = true;
    }
  }

  return { collabId, viewOnly };
}

export default function CollabContextProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(getCollabUser);
  const initialParams = useMemo(getCollabParamsFromUrl, []);
  const [collabId, setCollabId] = useState(initialParams.collabId);
  const [isViewOnly, setIsViewOnly] = useState(initialParams.viewOnly);
  const [isConnected, setIsConnected] = useState(false);
  const [peers, setPeers] = useState([]);
  const [followingUserId, setFollowingUserId] = useState(null);
  const [comments, setComments] = useState([]);
  const [isCommentMode, setIsCommentMode] = useState(false);

  const wsRef = useRef(null);
  const isApplyingRemoteRef = useRef(false);
  const remoteApplierRef = useRef(null);
  const viewportHandlerRef = useRef(null);
  const followingUserIdRef = useRef(followingUserId);
  followingUserIdRef.current = followingUserId;

  const lastCursorSendRef = useRef(0);
  const lastViewportSendRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);

  // Allow Workspace to register callbacks to apply incoming deltas
  const registerRemoteApplier = useCallback((applier) => {
    remoteApplierRef.current = applier;
  }, []);

  // Allow Canvas to register callback when following a collaborator's viewport
  const registerViewportHandler = useCallback((handler) => {
    viewportHandlerRef.current = handler;
  }, []);

  // Follow & Unfollow collaborator
  const followUser = useCallback((userId) => {
    if (!userId) {
      setFollowingUserId(null);
      return;
    }
    setFollowingUserId(userId);
  }, []);

  const unfollowUser = useCallback(() => {
    setFollowingUserId(null);
  }, []);

  // Update current user's display name
  const updateUserName = useCallback(
    (newName) => {
      if (!newName || !newName.trim()) return;
      const updated = { ...currentUser, name: newName.trim() };
      setCurrentUser(updated);
      saveCollabUser(updated);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "awareness",
            data: { name: updated.name },
          }),
        );
      }
    },
    [currentUser],
  );

  // Listen to popstate / hashchange for collabId & viewOnly changes
  useEffect(() => {
    const handleUrlChange = () => {
      const { collabId: newCollabId, viewOnly: newViewOnly } = getCollabParamsFromUrl();
      if (newCollabId !== collabId) {
        setCollabId(newCollabId);
      }
      if (newViewOnly !== isViewOnly) {
        setIsViewOnly(newViewOnly);
      }
    };
    window.addEventListener("hashchange", handleUrlChange);
    window.addEventListener("popstate", handleUrlChange);
    return () => {
      window.removeEventListener("hashchange", handleUrlChange);
      window.removeEventListener("popstate", handleUrlChange);
    };
  }, [collabId, isViewOnly]);

  // Connect WebSocket when collabId is present
  useEffect(() => {
    if (!collabId) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
      setPeers([]);
      setComments([]);
      setFollowingUserId(null);
      return;
    }

    let isCancelled = false;

    const connect = () => {
      if (isCancelled) return;

      const rawBackend =
        import.meta.env.VITE_BACKEND_URL ||
        "https://drawdb-backend.wk18k.workers.dev";
      const wsProtocol = rawBackend.startsWith("https") ? "wss:" : "ws:";
      const host = rawBackend.replace(/^https?:\/\//, "").replace(/\/+$/, "");
      const wsUrl = `${wsProtocol}//${host}/rooms/${collabId}/websocket?userId=${
        currentUser.id
      }&name=${encodeURIComponent(currentUser.name)}&color=${encodeURIComponent(
        currentUser.color,
      )}&viewOnly=${isViewOnly ? "1" : "0"}`;

      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        if (isCancelled) {
          socket.close();
          return;
        }
        setIsConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === "init") {
            const otherUsers = (msg.users || []).filter(
              (u) => u.id !== currentUser.id,
            );
            setPeers(otherUsers);

            if (msg.comments) {
              setComments(msg.comments);
            }

            if (msg.diagram && remoteApplierRef.current?.applySnapshot) {
              isApplyingRemoteRef.current = true;
              remoteApplierRef.current.applySnapshot(msg.diagram);
              setTimeout(() => {
                isApplyingRemoteRef.current = false;
              }, 100);
            }
          } else if (msg.type === "user_joined") {
            if (msg.user && msg.user.id !== currentUser.id) {
              setPeers((prev) => {
                const existing = prev.find((p) => p.id === msg.user.id);
                if (existing) {
                  return prev.map((p) => (p.id === msg.user.id ? { ...p, ...msg.user } : p));
                }
                return [...prev, msg.user];
              });
            }
          } else if (msg.type === "user_left") {
            setPeers((prev) => prev.filter((p) => p.id !== msg.userId));
            if (followingUserIdRef.current === msg.userId) {
              setFollowingUserId(null);
            }
          } else if (msg.type === "cursor") {
            setPeers((prev) =>
              prev.map((p) =>
                p.id === msg.userId ? { ...p, cursor: { x: msg.x, y: msg.y } } : p,
              ),
            );
          } else if (msg.type === "viewport") {
            if (followingUserIdRef.current === msg.userId && viewportHandlerRef.current) {
              viewportHandlerRef.current({ pan: msg.pan, zoom: msg.zoom });
            }
          } else if (msg.type === "awareness") {
            setPeers((prev) =>
              prev.map((p) =>
                p.id === msg.userId
                  ? { ...p, ...(msg.data || {}), linking: msg.data?.linking ?? p.linking }
                  : p,
              ),
            );
          } else if (msg.type === "delta") {
            if (msg.from !== currentUser.id && remoteApplierRef.current?.applyDelta) {
              isApplyingRemoteRef.current = true;
              remoteApplierRef.current.applyDelta(msg.delta);
              setTimeout(() => {
                isApplyingRemoteRef.current = false;
              }, 50);
            }
          } else if (msg.type === "full_sync") {
            if (msg.from !== currentUser.id && remoteApplierRef.current?.applySnapshot) {
              isApplyingRemoteRef.current = true;
              remoteApplierRef.current.applySnapshot(msg.diagram);
              setTimeout(() => {
                isApplyingRemoteRef.current = false;
              }, 100);
            }
          } else if (msg.type === "comment_added") {
            if (msg.comment) {
              setComments((prev) => {
                if (prev.some((c) => c.id === msg.comment.id)) return prev;
                return [...prev, msg.comment];
              });
            }
          } else if (msg.type === "comment_replied") {
            setComments((prev) =>
              prev.map((c) => {
                if (c.id !== msg.commentId) return c;
                const replies = c.replies || [];
                return { ...c, replies: [...replies, msg.reply] };
              }),
            );
          } else if (msg.type === "comment_resolved") {
            setComments((prev) =>
              prev.map((c) =>
                c.id === msg.commentId ? { ...c, resolved: msg.resolved } : c,
              ),
            );
          } else if (msg.type === "comment_deleted") {
            setComments((prev) => prev.filter((c) => c.id !== msg.commentId));
          }
        } catch (err) {
          console.error("Failed to parse websocket message:", err);
        }
      };

      socket.onclose = () => {
        setIsConnected(false);
        if (!isCancelled && collabId) {
          reconnectTimeoutRef.current = setTimeout(connect, 2000);
        }
      };

      socket.onerror = (err) => {
        console.warn("WebSocket error:", err);
        socket.close();
      };
    };

    connect();

    return () => {
      isCancelled = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
    };
  }, [collabId, currentUser.id, currentUser.name, currentUser.color, isViewOnly]);

  // Emit a local delta modification to remote collaborators
  const emitDelta = useCallback(
    (delta) => {
      if (isViewOnly || isApplyingRemoteRef.current) return;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "delta",
            delta,
          }),
        );
      }
    },
    [isViewOnly],
  );

  // Emit cursor movement (throttled to ~40ms)
  const emitCursor = useCallback((x, y) => {
    const now = Date.now();
    if (now - lastCursorSendRef.current < 40) return;
    lastCursorSendRef.current = now;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "cursor",
          x,
          y,
        }),
      );
    }
  }, []);

  // Emit viewport changes (throttled to ~60ms)
  const emitViewport = useCallback((pan, zoom) => {
    const now = Date.now();
    if (now - lastViewportSendRef.current < 60) return;
    lastViewportSendRef.current = now;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "viewport",
          pan,
          zoom,
        }),
      );
    }
  }, []);

  // Emit awareness data (e.g. linking lines)
  const emitAwareness = useCallback((data) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "awareness",
          data,
        }),
      );
    }
  }, []);

  // Comment Actions
  const addComment = useCallback(
    (x, y, text) => {
      if (!text || !text.trim()) return;
      const newComment = {
        id: nanoid(10),
        x: Math.round(x),
        y: Math.round(y),
        author: {
          id: currentUser.id,
          name: currentUser.name,
          color: currentUser.color,
        },
        text: text.trim(),
        createdAt: new Date().toISOString(),
        resolved: false,
        replies: [],
      };

      setComments((prev) => [...prev, newComment]);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "add_comment",
            comment: newComment,
          }),
        );
      }
    },
    [currentUser],
  );

  const replyComment = useCallback(
    (commentId, text) => {
      if (!text || !text.trim()) return;
      const newReply = {
        id: nanoid(10),
        author: {
          id: currentUser.id,
          name: currentUser.name,
          color: currentUser.color,
        },
        text: text.trim(),
        createdAt: new Date().toISOString(),
      };

      setComments((prev) =>
        prev.map((c) => {
          if (c.id !== commentId) return c;
          const replies = c.replies || [];
          return { ...c, replies: [...replies, newReply] };
        }),
      );

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "reply_comment",
            commentId,
            reply: newReply,
          }),
        );
      }
    },
    [currentUser],
  );

  const resolveComment = useCallback((commentId, resolved = true) => {
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, resolved } : c)),
    );

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "resolve_comment",
          commentId,
          resolved,
        }),
      );
    }
  }, []);

  const deleteComment = useCallback((commentId) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId));

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "delete_comment",
          commentId,
        }),
      );
    }
  }, []);

  // Start a new real-time collaboration session
  const startCollabSession = useCallback(
    async (initialDiagram) => {
      const newRoomId = nanoid(10);
      const rawBackend =
        import.meta.env.VITE_BACKEND_URL ||
        "https://drawdb-backend.wk18k.workers.dev";

      // Seed initial diagram into the room
      if (initialDiagram) {
        try {
          await fetch(`${rawBackend}/rooms/${newRoomId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(initialDiagram),
          });
        } catch (err) {
          console.warn("Failed to seed room initial state:", err);
        }
      }

      // Update URL with collabId
      const hash = window.location.hash || "#/editor";
      const hashParts = hash.split("?");
      const route = hashParts[0] || "#/editor";
      const params = new URLSearchParams(hashParts[1] || "");
      params.set("collabId", newRoomId);
      params.delete("viewOnly");

      const newHash = `${route}?${params.toString()}`;
      window.location.hash = newHash;
      setCollabId(newRoomId);
      setIsViewOnly(false);

      return newRoomId;
    },
    [],
  );

  // Leave active collaboration session
  const leaveCollabSession = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    const hash = window.location.hash || "#/editor";
    const hashParts = hash.split("?");
    const route = hashParts[0] || "#/editor";
    const params = new URLSearchParams(hashParts[1] || "");
    params.delete("collabId");
    params.delete("viewOnly");

    const qs = params.toString();
    window.location.hash = qs ? `${route}?${qs}` : route;
    setCollabId(null);
    setIsViewOnly(false);
    setIsConnected(false);
    setPeers([]);
    setComments([]);
    setFollowingUserId(null);
  }, []);

  const value = useMemo(
    () => ({
      collabId,
      isCollabActive: Boolean(collabId),
      isConnected,
      peers,
      currentUser,
      isViewOnly,
      followingUserId,
      followUser,
      unfollowUser,
      emitViewport,
      registerViewportHandler,
      comments,
      isCommentMode,
      setIsCommentMode,
      addComment,
      replyComment,
      resolveComment,
      deleteComment,
      updateUserName,
      emitDelta,
      emitAwareness,
      emitCursor,
      isApplyingRemoteRef,
      registerRemoteApplier,
      startCollabSession,
      leaveCollabSession,
    }),
    [
      collabId,
      isConnected,
      peers,
      currentUser,
      isViewOnly,
      followingUserId,
      followUser,
      unfollowUser,
      emitViewport,
      registerViewportHandler,
      comments,
      isCommentMode,
      setIsCommentMode,
      addComment,
      replyComment,
      resolveComment,
      deleteComment,
      updateUserName,
      emitDelta,
      emitAwareness,
      emitCursor,
      registerRemoteApplier,
      startCollabSession,
      leaveCollabSession,
    ],
  );

  return (
    <CollabContext.Provider value={value}>{children}</CollabContext.Provider>
  );
}
