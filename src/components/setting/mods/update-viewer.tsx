import { BaseDialog, DialogRef, Notice } from "@/components/base";
import { portableFlag } from "@/pages/_layout";
import { useSetUpdateState, useUpdateState } from "@/services/states";
import { Box, Button, LinearProgress } from "@mui/material";
import { Event, listen, UnlistenFn } from "@tauri-apps/api/event";
import { relaunch } from "@tauri-apps/plugin-process";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import { check } from "@tauri-apps/plugin-updater";
import { useLockFn } from "ahooks";
import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import useSWR from "swr";

let eventListener: UnlistenFn | null = null;

export const UpdateViewer = forwardRef<DialogRef>((props, ref) => {
  const { t } = useTranslation();

  const [open, setOpen] = useState(false);

  const updateState = useUpdateState();
  const setUpdateState = useSetUpdateState();

  const { data: updateInfo } = useSWR("checkUpdate", check, {
    errorRetryCount: 2,
    revalidateIfStale: false,
    focusThrottleInterval: 36e5, // 1 hour
  });

  const [downloaded, setDownloaded] = useState(0);
  const [buffer, setBuffer] = useState(0);
  const [total, setTotal] = useState(0);

  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
    close: () => setOpen(false),
  }));

  const markdownContent = useMemo(() => {
    if (!updateInfo?.body) {
      return "New Version is available";
    }
    return updateInfo?.body;
  }, [updateInfo]);

  const onUpdate = useLockFn(async () => {
    if (portableFlag) {
      Notice.error(t("Portable Updater Error"));
      return;
    }
    if (updateState) return;
    setUpdateState(true);
    if (eventListener !== null) {
      eventListener();
    }
    eventListener = await listen(
      "tauri://update-download-progress",
      (e: Event<any>) => {
        setTotal(e.payload.contentLength);
        setBuffer(e.payload.chunkLength);
        setDownloaded((a) => {
          return a + e.payload.chunkLength;
        });
      },
    );
    try {
      await updateInfo?.install();
      await relaunch();
    } catch (err: any) {
      Notice.error(err?.message || err.toString());
    } finally {
      setUpdateState(false);
    }
  });

  return (
    <BaseDialog
      open={open}
      title={
        <Box display="flex" justifyContent="space-between">
          {`New Version v${updateInfo?.version}`}
          <Box>
            <Button
              variant="contained"
              size="small"
              onClick={() => {
                openUrl(
                  `https://github.com/oomeow/clash-verge-rev/releases/tag/v${updateInfo?.version}`,
                );
              }}>
              {t("Go to Release Page")}
            </Button>
          </Box>
        </Box>
      }
      contentSx={{ minWidth: 360, maxWidth: 400, height: "50vh" }}
      okBtn={t("Update")}
      cancelBtn={t("Cancel")}
      onClose={() => setOpen(false)}
      onCancel={() => setOpen(false)}
      onOk={onUpdate}>
      <Box sx={{ height: "calc(100% - 10px)", overflow: "auto" }}>
        <ReactMarkdown
          components={{
            a: ({ node, ...props }) => {
              const { children } = props;
              return (
                <a {...props} target="_blank">
                  {children}
                </a>
              );
            },
          }}>
          {markdownContent}
        </ReactMarkdown>
      </Box>
      {updateState && (
        <LinearProgress
          variant="buffer"
          value={(downloaded / total) * 100}
          valueBuffer={buffer}
          sx={{ marginTop: "5px" }}
        />
      )}
    </BaseDialog>
  );
});
