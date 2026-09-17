import { useState } from "react";
import useCollab from "../../hooks/useCollab";
import {
  Button,
  TextArea,
  Popover,
  Avatar,
  Space,
} from "@douyinfe/semi-ui";
import {
  IconTick,
  IconDeleteStroked,
  IconClose,
} from "@douyinfe/semi-icons";
import { DateTime } from "luxon";

function formatTimestamp(isoString) {
  if (!isoString) return "";
  try {
    const dt = DateTime.fromISO(isoString);
    return dt.toRelative() || dt.toFormat("HH:mm");
  } catch {
    return "";
  }
}

export default function CollabComments({ draftLocation, setDraftLocation }) {
  const {
    comments,
    currentUser,
    isCollabActive,
    addComment,
    replyComment,
    resolveComment,
    deleteComment,
    setIsCommentMode,
  } = useCollab();

  const [activeCommentId, setActiveCommentId] = useState(null);
  const [draftText, setDraftText] = useState("");
  const [replyText, setReplyText] = useState("");
  const showResolved = true;

  if (!isCollabActive) return null;

  const handlePostDraft = () => {
    if (!draftText.trim() || !draftLocation) return;
    addComment(draftLocation.x, draftLocation.y, draftText.trim());
    setDraftText("");
    setDraftLocation(null);
    setIsCommentMode(false);
  };

  const handleCancelDraft = () => {
    setDraftText("");
    setDraftLocation(null);
    setIsCommentMode(false);
  };

  const handleSendReply = (commentId) => {
    if (!replyText.trim()) return;
    replyComment(commentId, replyText.trim());
    setReplyText("");
  };

  const visibleComments = comments.filter((c) => showResolved || !c.resolved);

  return (
    <g className="collab-comments">
      {/* Existing Comments */}
      {visibleComments.map((comment) => {
        const isResolved = Boolean(comment.resolved);
        const isOpen = activeCommentId === comment.id;
        const color = comment.author?.color || "#1890ff";
        const initial = (comment.author?.name || "U")[0].toUpperCase();
        const replyCount = (comment.replies || []).length;

        const popoverContent = (
          <div style={{ width: 300, maxWidth: "85vw" }} className="p-1">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--semi-color-border)]">
              <div className="flex items-center gap-2">
                <Avatar
                  size="extra-extra-small"
                  style={{ backgroundColor: color, color: "#fff", fontSize: 10 }}
                >
                  {initial}
                </Avatar>
                <div className="flex flex-col leading-tight">
                  <span className="text-xs font-semibold text-[var(--semi-color-text-0)]">
                    {comment.author?.name}
                  </span>
                  <span className="text-[10px] text-[var(--semi-color-text-2)]">
                    {formatTimestamp(comment.createdAt)}
                  </span>
                </div>
              </div>
              <Space>
                <Button
                  size="small"
                  theme={isResolved ? "solid" : "light"}
                  type={isResolved ? "primary" : "tertiary"}
                  icon={<IconTick />}
                  onClick={() => resolveComment(comment.id, !isResolved)}
                  title={isResolved ? "Re-open comment" : "Mark as resolved"}
                >
                  {isResolved ? "Resolved" : "Resolve"}
                </Button>
                {comment.author?.id === currentUser?.id && (
                  <Button
                    size="small"
                    type="danger"
                    theme="borderless"
                    icon={<IconDeleteStroked />}
                    onClick={() => {
                      deleteComment(comment.id);
                      setActiveCommentId(null);
                    }}
                    title="Delete thread"
                  />
                )}
              </Space>
            </div>

            {/* Comment Body */}
            <div className="text-xs text-[var(--semi-color-text-0)] whitespace-pre-wrap py-1">
              {comment.text}
            </div>

            {/* Replies Thread */}
            {replyCount > 0 && (
              <div className="mt-3 pt-2 border-t border-[var(--semi-color-border)] space-y-2 max-h-48 overflow-y-auto">
                {comment.replies.map((reply) => (
                  <div key={reply.id} className="flex gap-2 text-xs">
                    <Avatar
                      size="extra-extra-small"
                      style={{
                        backgroundColor: reply.author?.color || "#888",
                        color: "#fff",
                        fontSize: 9,
                        flexShrink: 0,
                      }}
                    >
                      {(reply.author?.name || "U")[0].toUpperCase()}
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 leading-none mb-1">
                        <span className="font-semibold text-[11px] text-[var(--semi-color-text-0)]">
                          {reply.author?.name}
                        </span>
                        <span className="text-[9px] text-[var(--semi-color-text-2)]">
                          {formatTimestamp(reply.createdAt)}
                        </span>
                      </div>
                      <div className="text-[11px] text-[var(--semi-color-text-1)] whitespace-pre-wrap">
                        {reply.text}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Reply Input Box */}
            <div className="mt-3 pt-2 border-t border-[var(--semi-color-border)] flex gap-1">
              <TextArea
                rows={1}
                placeholder="Reply..."
                value={replyText}
                onChange={(val) => setReplyText(val)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendReply(comment.id);
                  }
                }}
                className="text-xs !resize-none"
              />
              <Button
                type="primary"
                theme="solid"
                size="small"
                onClick={() => handleSendReply(comment.id)}
                disabled={!replyText.trim()}
              >
                Send
              </Button>
            </div>
          </div>
        );

        return (
          <foreignObject
            key={comment.id}
            x={comment.x - 14}
            y={comment.y - 14}
            width={34}
            height={34}
            className="overflow-visible pointer-events-auto"
          >
            <Popover
              content={popoverContent}
              trigger="click"
              position="top"
              visible={isOpen}
              onVisibleChange={(vis) => setActiveCommentId(vis ? comment.id : null)}
            >
              <div
                className={`relative w-7 h-7 rounded-full flex items-center justify-center cursor-pointer shadow-md transition-transform hover:scale-110 select-none ${
                  isResolved ? "opacity-60 grayscale-[0.3]" : ""
                }`}
                style={{
                  backgroundColor: color,
                  border: "2px solid #FFFFFF",
                }}
              >
                {isResolved ? (
                  <IconTick style={{ color: "#FFFFFF", fontSize: 13 }} />
                ) : (
                  <span className="text-[11px] font-bold text-white">
                    {initial}
                  </span>
                )}
                {replyCount > 0 && !isResolved && (
                  <span className="absolute -top-1 -right-1 bg-white text-zinc-800 text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center shadow-xs border border-zinc-200">
                    {replyCount}
                  </span>
                )}
              </div>
            </Popover>
          </foreignObject>
        );
      })}

      {/* Draft Comment Pin & Input Box */}
      {draftLocation && (
        <foreignObject
          x={draftLocation.x - 14}
          y={draftLocation.y - 14}
          width={300}
          height={200}
          className="overflow-visible pointer-events-auto z-40"
        >
          <div className="flex flex-col items-start">
            {/* Draft Pin Icon */}
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shadow-md animate-bounce select-none mb-1"
              style={{
                backgroundColor: currentUser?.color || "#1890ff",
                border: "2px solid #FFFFFF",
              }}
            >
              <span className="text-[11px] font-bold text-white">
                {(currentUser?.name || "U")[0].toUpperCase()}
              </span>
            </div>

            {/* Draft Card */}
            <div
              style={{ width: 280 }}
              className="p-2.5 rounded-lg shadow-xl border border-[var(--semi-color-border)] bg-[var(--semi-color-bg-2)]"
            >
              <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-[var(--semi-color-border)]">
                <span className="text-xs font-semibold text-[var(--semi-color-text-0)]">
                  Add a comment
                </span>
                <button
                  onClick={handleCancelDraft}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                >
                  <IconClose size="small" />
                </button>
              </div>
              <TextArea
                rows={2}
                placeholder="Write a comment... (Enter to post)"
                value={draftText}
                autoFocus
                onChange={(val) => setDraftText(val)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handlePostDraft();
                  } else if (e.key === "Escape") {
                    handleCancelDraft();
                  }
                }}
                className="text-xs !resize-none mb-2"
              />
              <div className="flex justify-end gap-1.5">
                <Button size="small" onClick={handleCancelDraft}>
                  Cancel
                </Button>
                <Button
                  size="small"
                  theme="solid"
                  type="primary"
                  onClick={handlePostDraft}
                  disabled={!draftText.trim()}
                >
                  Post
                </Button>
              </div>
            </div>
          </div>
        </foreignObject>
      )}
    </g>
  );
}
