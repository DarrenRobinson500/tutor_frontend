import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { apiFetch } from "../../utils/apiFetch"

import Editor from "@monaco-editor/react";
import * as monaco from "monaco-editor";

export interface EditorHandle {
  insertText: (text: string) => void;
}

interface EditorPanelProps {
  content: string;
  onChange: (value: string) => void;
  validation: any;
  templateId: number | string | null;
}

async function saveToBackend(templateId: string | number | null, content: string) {
  if (!templateId || templateId === "new") {
    console.log("Autosave skipped: no valid templateId yet");
    return;
  }
  const resp = await apiFetch("/api/templates/autosave/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ templateId, content }),
  });
  console.log("AUTOSAVE SENDING", { templateId, content });

  if (!resp.ok) {
    throw new Error(`Autosave failed: ${resp.status}`);
  }
}

export const EditorPanel = forwardRef<EditorHandle, EditorPanelProps>(
  ({ content, onChange, validation, templateId }, ref) => {
    const editorInstanceRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
    const backendTimeoutRef = useRef<number | null>(null);

    useImperativeHandle(ref, () => ({
      insertText(text: string) {
        const editor = editorInstanceRef.current;
        if (!editor) return;
        const position = editor.getPosition();
        if (!position) return;
        editor.executeEdits("parameter-helper", [{
          range: new monaco.Range(
            position.lineNumber, position.column,
            position.lineNumber, position.column
          ),
          text,
          forceMoveMarkers: true,
        }]);
        editor.focus();
      }
    }));

    // Disable Monaco YAML code actions to prevent worker crashes
    useEffect(() => {
      monaco.languages.registerCodeActionProvider("yaml", {
        provideCodeActions() {
          return { actions: [], dispose() {} };
        }
      });
    }, []);

    useEffect(() => {
      if (backendTimeoutRef.current) {
        window.clearTimeout(backendTimeoutRef.current);
      }

      backendTimeoutRef.current = window.setTimeout(() => {
        saveToBackend(templateId, content).catch((err) => {
          console.error("Backend autosave failed", err);
        });
      }, 1500);

      return () => {
        if (backendTimeoutRef.current) {
          window.clearTimeout(backendTimeoutRef.current);
        }
      };
    }, [content, templateId]);

    return (
      <Editor
        height="100%"
        defaultLanguage="yaml"
        value={content}
        onChange={(value) => onChange(value || "")}
        theme="vs-dark"
        onMount={(editor) => { editorInstanceRef.current = editor; }}
        options={{
          fontSize: 14,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: "on",
          lineNumbers: "on",
          tabSize: 2,
          insertSpaces: true,
          autoIndent: "full",

          // Disable worker-dependent features
          quickSuggestions: false,
          suggestOnTriggerCharacters: false,
          hover: { enabled: false },
          formatOnType: false,
          formatOnPaste: false,
        }}
      />
    );
  }
);
