import { Banner, Button, Input, Spin, Toast, Collapse, Tag, Space, Radio, RadioGroup, Typography } from "@douyinfe/semi-ui";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { IdContext } from "../../Workspace";
import { IconLink, IconCode } from "@douyinfe/semi-icons";
import {
  useAreas,
  useDiagram,
  useEnums,
  useNotes,
  useTransform,
  useTypes,
  useCollab,
} from "../../../hooks";
import { databases } from "../../../data/databases";
import { MODAL } from "../../../data/constants";
import { create, patch, SHARE_FILENAME } from "../../../api/gists";
import { getCustomTypes } from "../../../utils/customTypes";
import { Slot, useExtensions } from "../../../context/ExtensionsContext";
import { queryConfig } from "../../../utils/queryConfig";

export default function Share({ title, setModal }) {
  const { t } = useTranslation();
  const { gistId, setGistId } = useContext(IdContext);
  const [loading, setLoading] = useState(true);
  const { tables, relationships, database } = useDiagram();
  const { notes } = useNotes();
  const { areas } = useAreas();
  const { types } = useTypes();
  const { enums } = useEnums();
  const { transform } = useTransform();
  const [error, setError] = useState(null);

  const { collabId, isCollabActive, peers, startCollabSession } = useCollab();
  const [collabStarting, setCollabStarting] = useState(false);

  const [collabPermission, setCollabPermission] = useState("edit");

  const getCollabUrl = useCallback(
    (perm = collabPermission) => {
      const rawBase = import.meta.env.BASE_URL || window.location.pathname || "/";
      const base = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;
      const viewParam = perm === "view" ? "&viewOnly=1" : "";
      return `${window.location.origin}${base}#/editor?collabId=${collabId}${viewParam}`;
    },
    [collabId, collabPermission],
  );

  const copyCollabLink = useCallback(() => {
    navigator.clipboard.writeText(getCollabUrl()).then(() => {
      Toast.success(
        collabPermission === "view"
          ? "View-only link copied to clipboard!"
          : t("copied_to_clipboard") || "Collaboration link copied!",
      );
    });
  }, [getCollabUrl, collabPermission, t]);

  const handleStartCollab = async () => {
    try {
      setCollabStarting(true);
      const snapshot = {
        title,
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
      Toast.error(t("oops_smth_went_wrong"));
    } finally {
      setCollabStarting(false);
    }
  };

  const extensions = useExtensions();
  const customContent = extensions?.["share-modal-content"];

  const [embedSettings, setEmbedSettings] = useState({
    theme: null,
    hideHeader: null,
    hideSidebar: null,
    hideToolbar: null,
  });

  const url = useMemo(() => {
    const rawBase = import.meta.env.BASE_URL || window.location.pathname || "/";
    const base = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;
    const baseUrl = `${window.location.origin}${base}#/editor?shareId=${gistId}`;
    const params = new URLSearchParams();
    Object.entries(embedSettings).forEach(([key, value]) => {
      if (value) {
        params.append(queryConfig[key].key, value);
      }
    });
    const queryString = params.toString();
    return queryString ? baseUrl + "&" + queryString : baseUrl;
  }, [gistId, embedSettings]);

  const diagramToString = useCallback(() => {
    const allCustomTypes = getCustomTypes();
    const usedFieldTypes = new Set(
      tables.flatMap((t) => t.fields.map((f) => f.type.toUpperCase())),
    );
    const usedCustomTypes = {};
    for (const [db, types] of Object.entries(allCustomTypes)) {
      for (const [name, entry] of Object.entries(types)) {
        if (usedFieldTypes.has(name)) {
          if (!usedCustomTypes[db]) usedCustomTypes[db] = {};
          usedCustomTypes[db][name] = entry;
        }
      }
    }
    const hasCustomTypes = Object.keys(usedCustomTypes).length > 0;

    return JSON.stringify({
      title,
      tables: tables,
      relationships: relationships,
      notes: notes,
      subjectAreas: areas,
      database: database,
      ...(databases[database].hasTypes && { types: types }),
      ...(databases[database].hasEnums && { enums: enums }),
      ...(hasCustomTypes && { customTypes: usedCustomTypes }),
      transform: transform,
    });
  }, [
    areas,
    notes,
    tables,
    relationships,
    database,
    title,
    enums,
    types,
    transform,
  ]);

  const unshare = useCallback(async () => {
    try {
      const deleted = await patch(gistId, SHARE_FILENAME, undefined);
      if (deleted) {
        setGistId("");
      }
      setModal(MODAL.NONE);
    } catch (e) {
      console.error(e);
      setError(e);
    }
  }, [gistId, setModal, setGistId]);

  useEffect(() => {
    if (customContent) {
      setLoading(false);
      return;
    }
    const updateOrGenerateLink = async () => {
      try {
        setLoading(true);
        if (!gistId || gistId === "") {
          const id = await create(SHARE_FILENAME, diagramToString());
          setGistId(id);
        } else {
          await patch(gistId, SHARE_FILENAME, diagramToString());
        }
      } catch (e) {
        setError(e);
      } finally {
        setLoading(false);
      }
    };
    updateOrGenerateLink();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyLink = () => {
    navigator.clipboard
      .writeText(url)
      .then(() => {
        Toast.success(t("copied_to_clipboard"));
      })
      .catch(() => {
        Toast.error(t("oops_smth_went_wrong"));
      });
  };

  if (customContent) {
    return <div>{customContent}</div>;
  }

  return (
    <div>
      <Slot name="share-modal-top" />
      {loading && (
        <div className="text-blue-500 text-center">
          <Spin size="middle" />
          <div>{t("loading")}</div>
        </div>
      )}
      {!loading && error && (
        <Banner
          description={t("oops_smth_went_wrong")}
          type="danger"
          closeIcon={null}
          fullMode={false}
        />
      )}
      {!loading && !error && (
        <>
          <div className="flex gap-3">
            <Input value={url} size="large" readonly />
          </div>
          <div className="mt-3">
            <Collapse>
              <Collapse.Panel
                header={
                  <div className="flex items-center justify-between w-full pr-4">
                    <Space>
                      <IconCode />
                      <Typography.Text strong>
                        {t("embed_settings")}
                      </Typography.Text>
                    </Space>
                    <Space>
                      {queryConfig.theme.isValid(embedSettings.theme) && (
                        <Tag color="blue" size="small">
                          {t(embedSettings.theme)}
                        </Tag>
                      )}
                      {embedSettings.hideHeader && (
                        <Tag color="blue" size="small">
                          {t("header")}
                        </Tag>
                      )}
                      {embedSettings.hideSidebar && (
                        <Tag color="blue" size="small">
                          {t("sidebar")}
                        </Tag>
                      )}
                      {embedSettings.hideToolbar && (
                        <Tag color="blue" size="small">
                          {t("toolbar")}
                        </Tag>
                      )}
                    </Space>
                  </div>
                }
                itemKey="embed-settings"
              >
                <div className="space-y-4 py-2">
                  {Object.entries(queryConfig).map(([key, config]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-4"
                    >
                      <Typography.Text>{t(config.label)}</Typography.Text>
                      <RadioGroup
                        type="button"
                        name={config.key}
                        value={embedSettings[key]}
                        onChange={(e) =>
                          setEmbedSettings((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                      >
                        {config.options.map((option) => (
                          <Radio
                            key={String(option.value)}
                            value={option.value}
                          >
                            {t(option.label)}
                          </Radio>
                        ))}
                      </RadioGroup>
                    </div>
                  ))}
                </div>
              </Collapse.Panel>
            </Collapse>
          </div>
          <div className="mt-4 p-3.5 rounded-lg border border-[var(--semi-color-border)] bg-[var(--semi-color-fill-0)]">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 font-semibold text-sm text-[var(--semi-color-text-0)]">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isCollabActive
                      ? "bg-emerald-500 animate-pulse"
                      : "bg-zinc-400"
                  }`}
                />
                Live Collaboration
              </div>
              {isCollabActive && (
                <Tag color="emerald" size="small">
                  {peers.length + 1} online
                </Tag>
              )}
            </div>
            <div className="text-xs text-[var(--semi-color-text-2)] mb-3">
              {isCollabActive
                ? "Live session is active. Anyone with this link can collaborate and edit the diagram in real-time."
                : "Share this link to invite others to collaborate and edit this diagram together in real-time."}
            </div>
            {isCollabActive ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--semi-color-text-1)] font-medium">
                    Link permission:
                  </span>
                  <RadioGroup
                    type="button"
                    value={collabPermission}
                    onChange={(e) => setCollabPermission(e.target.value)}
                    size="small"
                  >
                    <Radio value="edit">Can edit</Radio>
                    <Radio value="view">Can view</Radio>
                  </RadioGroup>
                </div>
                <div className="flex gap-2">
                  <Input value={getCollabUrl()} size="default" readonly />
                  <Button
                    theme="solid"
                    type="primary"
                    icon={<IconLink />}
                    onClick={copyCollabLink}
                  >
                    {t("copy_link") || "Copy link"}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                theme="solid"
                type="primary"
                loading={collabStarting}
                onClick={handleStartCollab}
                block
              >
                Start Live Session
              </Button>
            )}
          </div>
          <div className="text-xs mt-2">{t("share_info")}</div>
          <div className="flex gap-2 mt-3">
            <Button block onClick={unshare}>
              {t("unshare")}
            </Button>
            <Button block theme="solid" icon={<IconLink />} onClick={copyLink}>
              {t("copy_link")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
