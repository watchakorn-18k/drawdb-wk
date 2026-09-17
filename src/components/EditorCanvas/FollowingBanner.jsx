import { useEffect } from "react";
import useCollab from "../../hooks/useCollab";

export default function FollowingBanner() {
  const { followingUserId, unfollowUser, peers } = useCollab();

  useEffect(() => {
    if (!followingUserId) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        unfollowUser();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [followingUserId, unfollowUser]);

  if (!followingUserId) return null;

  const followedPeer = peers.find((p) => p.id === followingUserId);
  const name = followedPeer?.name || "Collaborator";
  const color = followedPeer?.color || "#1890ff";

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 px-4 py-2 rounded-full shadow-lg bg-[var(--semi-color-bg-2)] border border-[var(--semi-color-border)] select-none animate-in fade-in slide-in-from-top-2 duration-150">
      <span
        className="w-2.5 h-2.5 rounded-full animate-pulse flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs font-medium text-[var(--semi-color-text-0)]">
        Following <span className="font-semibold">{name}</span>
      </span>
      <button
        type="button"
        onClick={unfollowUser}
        className="text-xs px-2.5 py-0.5 rounded-full bg-[var(--semi-color-fill-1)] hover:bg-[var(--semi-color-fill-2)] text-[var(--semi-color-text-1)] font-semibold transition-colors cursor-pointer"
      >
        Stop (Esc)
      </button>
    </div>
  );
}
