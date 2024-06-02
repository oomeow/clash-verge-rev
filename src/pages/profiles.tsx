import useSWR, { mutate } from "swr";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLockFn } from "ahooks";
import { useSetRecoilState } from "recoil";
import { Box, Button, IconButton, Stack, Divider } from "@mui/material";
import { LoadingButton } from "@mui/lab";
import {
  ClearRounded,
  ContentPasteRounded,
  LocalFireDepartmentRounded,
  RefreshRounded,
  TextSnippetOutlined,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import {
  getProfiles,
  importProfile,
  enhanceProfiles,
  getRuntimeLogs,
  deleteProfile,
  updateProfile,
  reorderProfile,
  createProfile,
} from "@/services/cmds";
import { atomLoadingCache } from "@/services/states";
import { closeAllConnections } from "@/services/api";
import { BasePage, DialogRef, Notice } from "@/components/base";
import {
  ProfileViewer,
  ProfileViewerRef,
} from "@/components/profile/profile-viewer";
import { ProfileMore } from "@/components/profile/profile-more";
import { useProfiles } from "@/hooks/use-profiles";
import { ConfigViewer } from "@/components/setting/mods/config-viewer";
import { throttle } from "lodash-es";
import { useRecoilState } from "recoil";
import { atomThemeMode } from "@/services/states";
import { BaseStyledTextField } from "@/components/base/base-styled-text-field";
import { ProfileItem } from "@/components/profile/profile-item";
import { listen } from "@tauri-apps/api/event";
import { readTextFile } from "@tauri-apps/api/fs";
import { readText } from "@tauri-apps/api/clipboard";

import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  TouchSensor,
  MouseSensor,
  KeyboardSensor,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import { DraggableProfileItem } from "@/components/profile/draggable-profile-item";
import { DraggableChainItem } from "@/components/profile/draggable-chain-item";
import { createPortal } from "react-dom";

interface ISortableItem {
  id: string;
  profileItem: IProfileItem;
}

const ProfilePage = () => {
  const { t } = useTranslation();

  const [url, setUrl] = useState("");
  const [disabled, setDisabled] = useState(false);
  const [activating, setActivating] = useState("");
  const [loading, setLoading] = useState(false);
  const {
    profiles = {},
    activateSelected,
    patchProfiles,
    mutateProfiles,
  } = useProfiles();

  const { data: chainLogs = {}, mutate: mutateLogs } = useSWR(
    "getRuntimeLogs",
    getRuntimeLogs,
  );

  const chain = profiles.chain || [];
  const viewerRef = useRef<ProfileViewerRef>(null);
  const configRef = useRef<DialogRef>(null);
  const [reactivating, setReactivating] = useState(false);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor),
  );

  const [draggingProfileItem, setDraggingProfileItem] =
    useState<ISortableItem | null>(null);
  const [draggingChainItem, setDraggingChainItem] =
    useState<ISortableItem | null>(null);
  const [overItemWidth, setOverItemWidth] = useState(260);

  const handleProfileDragOver = (event: DragOverEvent) => {
    const item = regularItems.find((i) => i.id === event.active.id)!;
    const itemWidth = event.over?.rect.width || 260;
    setDraggingProfileItem(item);
    setOverItemWidth(itemWidth);
  };

  const [profileList, setProfileList] = useState<ISortableItem[]>([]);
  const [chainList, setChainList] = useState<ISortableItem[]>([]);

  // distinguish type
  const { regularItems } = useMemo(() => {
    const items = profiles.items || [];
    const chainIds = profiles.chain || [];

    const type1 = ["local", "remote"];
    const type2 = ["merge", "script"];

    const regularItems = items
      .filter((i) => i && type1.includes(i.type!))
      .map((i) => {
        const item: ISortableItem = {
          id: i.uid,
          profileItem: i,
        };
        return item;
      });
    const restItems = items
      .filter((i) => i && type2.includes(i.type!))
      .map((i) => {
        const item: ISortableItem = {
          id: i.uid,
          profileItem: i,
        };
        return item;
      });
    const restMap = Object.fromEntries(restItems.map((i) => [i.id, i]));
    const enhanceItems = chainIds
      .map((i) => restMap[i]!)
      .filter(Boolean)
      .concat(restItems.filter((i) => !chainIds.includes(i.id)));
    setProfileList(regularItems);
    setChainList(enhanceItems);
    return { regularItems };
  }, [profiles]);

  useEffect(() => {
    const unlisten = listen("tauri://file-drop", async (event) => {
      const fileList = event.payload as string[];
      for (let file of fileList) {
        if (!file.endsWith(".yaml") && !file.endsWith(".yml")) {
          Notice.error(t("Only YAML Files Supported"));
          continue;
        }
        const item = {
          type: "local",
          name: file.split(/\/|\\/).pop() ?? "New Profile",
          desc: "",
          url: "",
          option: {
            with_proxy: false,
            self_proxy: false,
          },
        } as IProfileItem;
        let data = await readTextFile(file);
        await createProfile(item, data);
        await mutateProfiles();
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleProfileDragEnd = async (event: DragEndEvent) => {
    setDraggingProfileItem(null);
    const { active, over } = event;
    if (over) {
      const activeId = active.id.toString();
      const overId = over.id.toString();
      if (activeId !== overId) {
        await reorderProfile(activeId.toString(), overId.toString());
        mutateProfiles();
      }
    }
  };

  const handleChainDragEnd = async (event: DragEndEvent) => {
    setDraggingChainItem(null);
    const { active, over } = event;
    if (over) {
      const activeItemSelected = active.data.current?.activated;
      const overItemSelected = over.data.current?.activated;
      if (activeItemSelected !== overItemSelected) {
        Notice.error(t("Scripts in different states do not support sorting"));
      }
      if (activeItemSelected && overItemSelected) {
        const acIndex = chain.findIndex(
          (item) => item === active.id.toString(),
        );
        const ovIndex = chain.findIndex((item) => item === over.id.toString());
        const newChain = [...chain];
        newChain[acIndex] = over.id.toString();
        newChain[ovIndex] = active.id.toString();
        const list = newChain.map(
          (item) => chainList.find((e) => e.id === item)!,
        );
        if (list && list.length > 0) {
          setChainList(list.concat(chainList.filter((e) => !list.includes(e))));
          await setList(list);
        }
      } else {
        const activeId = active.id.toString();
        const overId = over.id.toString();
        if (activeId !== overId) {
          await reorderProfile(activeId, overId);
          mutateProfiles();
        }
      }
    }
  };

  const onImport = async () => {
    if (!url) return;
    setLoading(true);

    try {
      await importProfile(url);
      Notice.success(t("Profile Imported Successfully"));
      setUrl("");
      setLoading(false);

      getProfiles().then((newProfiles) => {
        mutate("getProfiles", newProfiles);

        const remoteItem = newProfiles.items?.find((e) => e.type === "remote");
        if (!newProfiles.current && remoteItem) {
          const current = remoteItem.uid;
          patchProfiles({ current });
          mutateLogs();
          setTimeout(() => activateSelected(), 2000);
        }
      });
    } catch (err: any) {
      Notice.error(err.message || err.toString());
      setLoading(false);
    } finally {
      setDisabled(false);
      setLoading(false);
    }
  };

  const onSelect = useLockFn(async (current: string, force: boolean) => {
    if (!force && current === profiles.current) return;
    // 避免大多数情况下loading态闪烁
    const reset = setTimeout(() => setActivating(current), 100);
    try {
      await patchProfiles({ current });
      mutateLogs();
      closeAllConnections();
      setTimeout(() => activateSelected(), 2000);
      Notice.success(t("Profile Switched"), 1000);
    } catch (err: any) {
      Notice.error(err?.message || err.toString(), 4000);
    } finally {
      clearTimeout(reset);
      setActivating("");
    }
  });

  const setList = async (newList: ISortableItem[]) => {
    const newChain = newList
      .filter((item) => chain.includes(item.id))
      .map((item) => item.id);
    let needUpdate = false;
    for (let index = 0; index < chain.length; index++) {
      const chainId = chain[index];
      const newChainId = newChain[index];
      if (chainId !== newChainId) {
        needUpdate = true;
        break;
      }
    }
    if (needUpdate && !reactivating) {
      try {
        setReactivating(true);
        await patchProfiles({ chain: newChain });
        mutateLogs();
        Notice.success("Refresh clash config", 1000);
      } catch (err: any) {
        Notice.error(err.message || err.toString());
      } finally {
        setReactivating(false);
      }
    }
  };

  const onEnhance = useLockFn(async () => {
    try {
      setReactivating(true);
      await enhanceProfiles();
      mutateLogs();
      Notice.success(t("Profile Reactivated"), 1000);
    } catch (err: any) {
      Notice.error(err.message || err.toString(), 3000);
    }
    setReactivating(false);
  });

  const onEnable = useLockFn(async (uid: string) => {
    if (chain.includes(uid)) return;
    try {
      setReactivating(true);
      const newChain = [...chain, uid];
      await patchProfiles({ chain: newChain });
      mutateLogs();
    } catch (err: any) {
      Notice.error(err?.message || err.toString());
    } finally {
      setReactivating(false);
    }
  });

  const onDisable = useLockFn(async (uid: string) => {
    if (!chain.includes(uid)) return;
    try {
      setReactivating(true);
      const newChain = chain.filter((i) => i !== uid);
      await patchProfiles({ chain: newChain });
      mutateLogs();
    } catch (err: any) {
      Notice.error(err?.message || err.toString());
    } finally {
      setReactivating(false);
    }
  });

  const onDelete = useLockFn(async (uid: string) => {
    try {
      await onDisable(uid);
      await deleteProfile(uid);
      mutateProfiles();
      mutateLogs();
    } catch (err: any) {
      Notice.error(err?.message || err.toString());
    }
  });

  // 更新所有订阅
  const setLoadingCache = useSetRecoilState(atomLoadingCache);
  const onUpdateAll = useLockFn(async () => {
    const throttleMutate = throttle(mutateProfiles, 2000, {
      trailing: true,
    });
    const updateOne = async (uid: string) => {
      try {
        await updateProfile(uid);
        throttleMutate();
      } finally {
        setLoadingCache((cache) => ({ ...cache, [uid]: false }));
      }
    };

    return new Promise((resolve) => {
      setLoadingCache((cache) => {
        // 获取没有正在更新的订阅
        const items = regularItems.filter(
          (e) => e.profileItem.type === "remote" && !cache[e.id],
        );
        const change = Object.fromEntries(items.map((e) => [e.id, true]));

        Promise.allSettled(items.map((e) => updateOne(e.id))).then(resolve);
        return { ...cache, ...change };
      });
    });
  });

  const onCopyLink = async () => {
    const text = await readText();
    if (text) setUrl(text);
  };
  const [mode] = useRecoilState(atomThemeMode);
  const islight = mode === "light" ? true : false;
  const dividercolor = islight
    ? "rgba(0, 0, 0, 0.06)"
    : "rgba(255, 255, 255, 0.06)";

  return (
    <BasePage
      full
      title={t("Profiles")}
      contentStyle={{ height: "100%" }}
      header={
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <IconButton
            size="small"
            color="inherit"
            title={t("Update All Profiles")}
            onClick={onUpdateAll}>
            <RefreshRounded />
          </IconButton>

          <IconButton
            size="small"
            color="inherit"
            title={t("View Runtime Config")}
            onClick={() => configRef.current?.open()}>
            <TextSnippetOutlined />
          </IconButton>

          <LoadingButton
            size="small"
            loading={reactivating}
            loadingPosition="end"
            variant="contained"
            color="primary"
            endIcon={<LocalFireDepartmentRounded />}
            title={t("Reactivate Profiles")}
            onClick={onEnhance}>
            <span>{t("Reactivate Profiles")}</span>
          </LoadingButton>

          {/* <IconButton
            size="small"
            color="primary"
            title={t("Reactivate Profiles")}
            onClick={onEnhance}>
            <LocalFireDepartmentRounded />
          </IconButton> */}
        </Box>
      }>
      <Stack
        direction="row"
        spacing={1}
        sx={{
          pt: 1,
          mb: 0.5,
          mx: "10px",
          height: "36px",
          display: "flex",
          alignItems: "center",
        }}>
        <BaseStyledTextField
          value={url}
          variant="outlined"
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t("Profile URL")}
          InputProps={{
            sx: { pr: 1 },
            endAdornment: !url ? (
              <IconButton
                size="small"
                sx={{ p: 0.5 }}
                title={t("Paste")}
                onClick={onCopyLink}>
                <ContentPasteRounded fontSize="inherit" />
              </IconButton>
            ) : (
              <IconButton
                size="small"
                sx={{ p: 0.5 }}
                title={t("Clear")}
                onClick={() => setUrl("")}>
                <ClearRounded fontSize="inherit" />
              </IconButton>
            ),
          }}
        />
        <LoadingButton
          disabled={!url || disabled}
          loading={loading}
          variant="contained"
          size="small"
          sx={{ borderRadius: "6px" }}
          onClick={onImport}>
          {t("Import")}
        </LoadingButton>
        <Button
          variant="contained"
          size="small"
          sx={{ borderRadius: "6px" }}
          onClick={() => viewerRef.current?.create()}>
          {t("New")}
        </Button>
      </Stack>
      <Box
        sx={{
          pt: 1,
          mb: 0.5,
          px: "10px",
          height: "calc(100% - 68px)",
          overflowY: "auto",
        }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          // modifiers={[restrictToParentElement]}
          onDragOver={handleProfileDragOver}
          onDragEnd={handleProfileDragEnd}>
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              width: "calc(100% - 15px)",
            }}>
            <SortableContext items={profileList.map((item) => item.id)}>
              {profileList.map((item) => (
                <DraggableProfileItem
                  key={item.id}
                  id={item.id}
                  selected={
                    (activating === "" && profiles.current === item.id) ||
                    activating === item.id
                  }
                  activating={
                    activating === item.id ||
                    (profiles.current === item.id && reactivating)
                  }
                  itemData={item.profileItem}
                  onSelect={(f) => onSelect(item.id, f)}
                  onEdit={() => viewerRef.current?.edit(item.profileItem)}
                  onReactivate={onEnhance}
                />
              ))}
            </SortableContext>
            {[...new Array(20)].map((_) => (
              <i
                style={{
                  display: "flex",
                  flexGrow: "1",
                  margin: "0 5px",
                  width: "260px",
                  height: "0",
                }}></i>
            ))}
          </Box>
          <DragOverlay dropAnimation={null}>
            {draggingProfileItem ? (
              <ProfileItem
                id={draggingProfileItem.id}
                sx={{ width: overItemWidth }}
                selected={
                  (activating === "" &&
                    profiles.current === draggingProfileItem.id) ||
                  activating === draggingProfileItem.id
                }
                activating={
                  activating === draggingProfileItem.id ||
                  (profiles.current === draggingProfileItem.id && reactivating)
                }
                itemData={draggingProfileItem.profileItem}
                onSelect={(f) => onSelect(draggingProfileItem.id, f)}
                onEdit={() =>
                  viewerRef.current?.edit(draggingProfileItem.profileItem)
                }
                onReactivate={onEnhance}
              />
            ) : null}
          </DragOverlay>
        </DndContext>

        {chainList.length > 0 && (
          <Divider
            variant="middle"
            flexItem
            sx={{
              width: `calc(100% - 32px)`,
              my: 1,
              borderColor: dividercolor,
            }}>
            {t("Enhance Scripts")}
          </Divider>
        )}

        {chainList.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragOver={(event) => {
              const item = chainList.find(
                (item) => item.id === event.active.id,
              )!;
              const itemWidth = event.over?.rect.width || 260;
              setDraggingChainItem(item);
              setOverItemWidth(itemWidth);
            }}
            onDragCancel={() => {
              setDraggingChainItem(null);
            }}
            onDragEnd={handleChainDragEnd}>
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                width: "calc(100% - 15px)",
              }}>
              <SortableContext
                items={chainList.map((item) => item.id)}
                strategy={rectSortingStrategy}>
                {chainList.map((item) => (
                  <DraggableChainItem
                    key={item.id}
                    id={item.id}
                    selected={!!chain.includes(item.id)}
                    itemData={item.profileItem}
                    enableNum={chain.length || 0}
                    logInfo={chainLogs[item.id]}
                    reactivating={
                      !!chain.includes(item.id) &&
                      (reactivating || activating !== "")
                    }
                    onEnable={() => onEnable(item.id)}
                    onDisable={() => onDisable(item.id)}
                    onDelete={() => onDelete(item.id)}
                    onEdit={() => viewerRef.current?.edit(item.profileItem)}
                    onActivatedSave={onEnhance}
                  />
                ))}
              </SortableContext>
              {[...new Array(20)].map((_) => (
                <i
                  style={{
                    display: "flex",
                    flexGrow: "1",
                    margin: "0 5px",
                    width: "260px",
                    height: "0",
                  }}></i>
              ))}
            </Box>
            {createPortal(
              <DragOverlay dropAnimation={null}>
                {draggingChainItem && (
                  <ProfileMore
                    selected={!!chain.includes(draggingChainItem.id)}
                    itemData={draggingChainItem.profileItem}
                    sx={{ width: overItemWidth }}
                    enableNum={chain.length || 0}
                    logInfo={chainLogs[draggingChainItem.id]}
                    reactivating={
                      !!chain.includes(draggingChainItem.id) &&
                      (reactivating || activating !== "")
                    }
                    onEnable={() => onEnable(draggingChainItem.id)}
                    onDisable={() => onDisable(draggingChainItem.id)}
                    onDelete={() => onDelete(draggingChainItem.id)}
                    onEdit={() =>
                      viewerRef.current?.edit(draggingChainItem.profileItem)
                    }
                    onActivatedSave={onEnhance}
                  />
                )}
              </DragOverlay>,
              document.body,
            )}
          </DndContext>
        )}
      </Box>
      <ProfileViewer ref={viewerRef} onChange={() => mutateProfiles()} />
      <ConfigViewer ref={configRef} />
    </BasePage>
  );
};

export default ProfilePage;
