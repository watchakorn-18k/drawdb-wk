import { memo } from "react";
import useCollab from "../../hooks/useCollab";

function CollabCursors() {
  const { peers, isCollabActive } = useCollab();

  if (!isCollabActive || !peers || peers.length === 0) {
    return null;
  }

  return (
    <g className="collab-cursors" style={{ pointerEvents: "none", userSelect: "none" }}>
      {peers.map((peer) => {
        if (!peer || !peer.cursor) return null;
        const { x, y } = peer.cursor;
        const color = peer.color || "#1890ff";
        const name = peer.name || "Collaborator";

        return (
          <g key={peer.id} transform={`translate(${x}, ${y})`} className="transition-transform duration-75 ease-out">
            {/* Figma-style SVG Mouse Arrow */}
            <path
              d="M0 0 L0 18 L4.5 13.5 L8.5 22.5 L11.5 21 L7.5 12 L13 12 Z"
              fill={color}
              stroke="#FFFFFF"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            {/* User Name Badge */}
            <g transform="translate(12, 14)">
              <rect
                x="0"
                y="0"
                width={Math.max(name.length * 7 + 12, 36)}
                height="20"
                rx="4"
                ry="4"
                fill={color}
                opacity="0.95"
              />
              <text
                x="6"
                y="14"
                fill="#FFFFFF"
                fontSize="11"
                fontWeight="600"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                {name}
              </text>
            </g>

            {/* If collaborator is dragging a linking relationship line */}
            {peer.linking && (
              <line
                x1={peer.linking.startX - x}
                y1={peer.linking.startY - y}
                x2={peer.linking.endX - x}
                y2={peer.linking.endY - y}
                stroke={color}
                strokeWidth="2"
                strokeDasharray="4 4"
                opacity="0.8"
              />
            )}
          </g>
        );
      })}
    </g>
  );
}

export default memo(CollabCursors);
