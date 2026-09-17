import { useState } from "react";
import {
  Avatar,
  AvatarGroup,
  Button,
  Popover,
  Input,
  Tag,
  Toast,
  Space,
  Typography,
} from "@douyinfe/semi-ui";
import {
  IconCopy,
  IconTick,
  IconUserGroup,
  IconExit,
} from "@douyinfe/semi-icons";
import useCollab from "../../hooks/useCollab";
import { useDiagram, useNotes, useAreas, useTypes, useEnums } from "../../hooks";

export default function CollabHeader() {
  const {
    collabId,
    isCollabActive,
    isConnected,
    peers,
    currentUser,
    updateUserName,
    startCollabSession,
    leaveCollabSession,
  } = useCollab();

  const { tables, relationships, database } = useDiagram();
  const { notes } = useNotes();
  const { areas } = useAreas();
  const { types } = useTypes();
  const { enums } = useEnums();

  const [isStarting, setIsStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingName, setEditingName] = useState(currentUser?.name || "");

  const getCollabUrl = () => {
    const rawBase = import.meta.env.BASE_URL || window.location.pathname || "/";
    const base = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;
    return `${window.location.origin}${base}#/editor?collabId=${collabId}`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCollabUrl()).then(() => {
      setCopied(true);
      Toast.success("Collaboration link copied!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleStartSession = async () => {
    try {
      setIsStarting(true);
      const snapshot = {
        database,
        tables,
        relationships,
        notes,
        subjectAreas: areas,
        types,
        enums,
      };
      await startCollabSession(snapshot);
      Toast.success("Live collaboration session started!");
    } catch {
      Toast.error("Failed to start live collaboration session");
    } finally {
      setIsStarting(false);
    }
  };

  const handleSaveName = () => {
    if (editingName.trim()) {
      updateUserName(editingName.trim());
      Toast.success("Display name updated");
    }
  };

  if (!isCollabActive) {
    return (
      <Button
        theme="light"
        type="tertiary"
        icon={<IconUserGroup />}
        loading={isStarting}
        onClick={handleStartSession}
        className="!rounded-md"
        title="Live Collaboration (Real-time diagram sharing)"
      >
        Live Collab
      </Button>
    );
  }

  const allUsers = [
    { id: currentUser.id, name: `${currentUser.name} (You)`, color: currentUser.color },
    ...peers,
  ];

  const content = (
    <div style={{ width: 280, padding: 8 }}>
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-color">
        <Space>
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: isConnected ? "#10B981" : "#F59E0B" }}
          />
          <Typography.Text strong>
            {isConnected ? "Live Connected" : "Connecting..."}
          </Typography.Text>
        </Space>
        <Tag color="emerald" size="small">
          {allUsers.length} online
        </Tag>
      </div>

      <div className="mb-3">
        <Typography.Text type="secondary" size="small" className="block mb-1">
          Your display name:
        </Typography.Text>
        <Space style={{ width: "100%" }}>
          <Input
            value={editingName}
            onChange={(val) => setEditingName(val)}
            onPressEnter={handleSaveName}
            size="small"
          />
          <Button size="small" icon={<IconTick />} onClick={handleSaveName} />
        </Space>
      </div>

      <div className="mb-3">
        <Typography.Text type="secondary" size="small" className="block mb-1">
          Invite link:
        </Typography.Text>
        <div className="flex gap-1">
          <Input value={getCollabUrl()} size="small" readonly />
          <Button
            size="small"
            type="primary"
            icon={copied ? <IconTick /> : <IconCopy />}
            onClick={handleCopy}
          >
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>

      <div className="mb-3">
        <Typography.Text type="secondary" size="small" className="block mb-1">
          Collaborators in session:
        </Typography.Text>
        <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
          {allUsers.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-[var(--semi-color-fill-1)] transition-colors"
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: u.color }}
              />
              <span className="text-xs truncate">{u.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-2 border-t border-color text-right">
        <Button
          type="danger"
          theme="borderless"
          size="small"
          icon={<IconExit />}
          onClick={leaveCollabSession}
        >
          Leave session
        </Button>
      </div>
    </div>
  );

  return (
    <Popover content={content} trigger="click" position="bottomRight">
      <div className="flex items-center gap-2 cursor-pointer py-1.5 px-2.5 rounded-md transition-colors border border-[var(--semi-color-border)] bg-[var(--semi-color-fill-0)] hover:bg-[var(--semi-color-fill-1)] select-none">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="text-xs font-semibold text-[var(--semi-color-text-0)]">
          Live ({allUsers.length})
        </span>
        <AvatarGroup maxCount={3} size="extra-extra-small">
          {allUsers.map((u) => (
            <Avatar
              key={u.id}
              size="extra-extra-small"
              style={{ backgroundColor: u.color, color: "#FFFFFF", fontSize: 10 }}
            >
              {(u.name || "U")[0].toUpperCase()}
            </Avatar>
          ))}
        </AvatarGroup>
      </div>
    </Popover>
  );
}
