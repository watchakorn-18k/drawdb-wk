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
  updateUserName: () => {},
  emitDelta: () => {},
  emitAwareness: () => {},
  emitCursor: () => {},
  isApplyingRemoteRef: { current: false },
  registerRemoteApplier: () => {},
  startCollabSession: async () => {},
  leaveCollabSession: () => {},
});

function getCollabIdFromUrl() {
  if (typeof window === "undefined") return null;

  // Check URL hash, e.g. #/editor?collabId=xyz
  if (window.location.hash.includes("?")) {
    const qs = window.location.hash.slice(window.location.hash.indexOf("?"));
    const val = new URLSearchParams(qs).get("collabId");
    if (val) return val;
  }

  // Check main query string
  const val = new URLSearchParams(window.location.search).get("collabId");
  if (val) return val;

  return null;
}

export default function CollabContextProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(getCollabUser);
  const [collabId, setCollabId] = useState(getCollabIdFromUrl);
  const [isConnected, setIsConnected] = useState(false);
  const [peers, setPeers] = useState([]);

  const wsRef = useRef(null);
  const isApplyingRemoteRef = useRef(false);
  const remoteApplierRef = useRef(null);
  const lastCursorSendRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);

  // Allow Workspace to register callbacks to apply incoming deltas
  const registerRemoteApplier = useCallback((applier) => {
    remoteApplierRef.current = applier;
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

  // Listen to popstate / hashchange for collabId changes
  useEffect(() => {
    const handleUrlChange = () => {
      const id = getCollabIdFromUrl();
      if (id !== collabId) {
        setCollabId(id);
      }
    };
    window.addEventListener("hashchange", handleUrlChange);
    window.addEventListener("popstate", handleUrlChange);
    return () => {
      window.removeEventListener("hashchange", handleUrlChange);
      window.removeEventListener("popstate", handleUrlChange);
    };
  }, [collabId]);

  // Connect WebSocket when collabId is present
  useEffect(() => {
    if (!collabId) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
      setPeers([]);
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
      )}`;

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
            // Received initial room state
            const otherUsers = (msg.users || []).filter(
              (u) => u.id !== currentUser.id,
            );
            setPeers(otherUsers);

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
          } else if (msg.type === "cursor") {
            setPeers((prev) =>
              prev.map((p) =>
                p.id === msg.userId ? { ...p, cursor: { x: msg.x, y: msg.y } } : p,
              ),
            );
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
          }
        } catch (err) {
          console.error("Failed to parse websocket message:", err);
        }
      };

      socket.onclose = () => {
        setIsConnected(false);
        if (!isCancelled && collabId) {
          // Auto reconnect after 2 seconds
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
  }, [collabId, currentUser.id, currentUser.name, currentUser.color]);

  // Emit a local delta modification to remote collaborators
  const emitDelta = useCallback((delta) => {
    if (isApplyingRemoteRef.current) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "delta",
          delta,
        }),
      );
    }
  }, []);

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

      const newHash = `${route}?${params.toString()}`;
      window.location.hash = newHash;
      setCollabId(newRoomId);

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

    const qs = params.toString();
    window.location.hash = qs ? `${route}?${qs}` : route;
    setCollabId(null);
    setIsConnected(false);
    setPeers([]);
  }, []);

  const value = useMemo(
    () => ({
      collabId,
      isCollabActive: Boolean(collabId),
      isConnected,
      peers,
      currentUser,
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
