import { useEffect, useRef } from "react";
import { useLockFn } from "ahooks";
import { useRecoilValue } from "recoil";
import { useTranslation } from "react-i18next";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import { atomThemeMode } from "@/services/states";
import { readProfileFile, saveProfileFile } from "@/services/cmds";
import { Notice } from "@/components/base";
import { nanoid } from "nanoid";

import * as monaco from "monaco-editor";
import { configureMonacoYaml } from "monaco-yaml";

import { type JSONSchema7 } from "json-schema";
import metaSchema from "meta-json-schema/schemas/meta-json-schema.json";
import mergeSchema from "meta-json-schema/schemas/clash-verge-merge-json-schema.json";
import { useWindowSize } from "@/components/proxy/use-window-width";

interface Props {
  uid: string;
  open: boolean;
  language: "yaml" | "javascript";
  schema?: "clash" | "merge";
  onClose: () => void;
  onChange?: () => void;
}

// yaml worker
configureMonacoYaml(monaco, {
  validate: true,
  enableSchemaRequest: true,
  schemas: [
    {
      uri: "http://example.com/meta-json-schema.json",
      fileMatch: ["**/*.clash.yaml"],
      schema: metaSchema as JSONSchema7,
    },
    {
      uri: "http://example.com/clash-verge-merge-json-schema.json",
      fileMatch: ["**/*.merge.yaml"],
      schema: mergeSchema as JSONSchema7,
    },
  ],
});

export const EditorViewer = (props: Props) => {
  const { uid, open, language, schema, onClose, onChange } = props;
  const { t } = useTranslation();
  const editorRef = useRef<any>();
  const instanceRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const themeMode = useRecoilValue(atomThemeMode);
  const { width, height } = useWindowSize();

  useEffect(() => {
    if (!open) return;

    readProfileFile(uid).then((data) => {
      const dom = editorRef.current;

      if (!dom) return;

      if (instanceRef.current) instanceRef.current.dispose();

      const uri = monaco.Uri.parse(`${nanoid()}.${schema}.${language}`);
      const model = monaco.editor.createModel(data, language, uri);
      instanceRef.current = monaco.editor.create(editorRef.current, {
        model: model,
        language: language,
        tabSize: ["yaml", "javascript"].includes(language) ? 2 : 4, // 根据语言类型设置缩进
        theme: themeMode === "light" ? "vs" : "vs-dark",
        mouseWheelZoom: true,
        quickSuggestions: {
          strings: true,
          comments: true,
          other: true,
        },
        automaticLayout: true,
      });
    });

    return () => {
      if (instanceRef.current) {
        instanceRef.current.dispose();
        instanceRef.current = null;
      }
    };
  }, [open]);

  instanceRef.current?.updateOptions({
    minimap: { enabled: width >= 1000 },
  });

  const onSave = useLockFn(async () => {
    const value = instanceRef.current?.getValue();

    if (value == null) return;

    try {
      await saveProfileFile(uid, value);
      onChange?.();
      onClose();
    } catch (err: any) {
      Notice.error(err.message || err.toString());
    }
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
      <DialogTitle>{t("Edit File")}</DialogTitle>

      <DialogContent
        sx={{
          width: "94%",
          height: `${height - 200}px`,
          pb: 1,
          userSelect: "text",
        }}
      >
        <div style={{ width: "100%", height: "100%" }} ref={editorRef} />
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="outlined">
          {t("Cancel")}
        </Button>
        <Button onClick={onSave} variant="contained">
          {t("Save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
