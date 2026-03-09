import Editor from "@monaco-editor/react";
import { useOthers, useStorage, useMutation } from "../liveblocks.config";
import { useEffect, useRef } from "react";

function CollaborativeEditor({ language, onCodeChange, options = {} }) {
  const others = useOthers();
  const editorRef = useRef(null);
  const isRemoteUpdate = useRef(false);

  // Read shared code from Liveblocks storage
  const code = useStorage((root) => root.code);

  // Write shared code to Liveblocks storage
  const setCode = useMutation(({ storage }, newCode) => {
    storage.set("code", newCode);
  }, []);

  // When remote storage changes, update Monaco editor content
  useEffect(() => {
    if (!editorRef.current || code === undefined || code === null) {
      console.warn("⚠️ [Liveblocks] Skipping editor update - editor not ready or code is null/undefined");
      return;
    }

    const currentValue = editorRef.current.getValue();

    if (currentValue !== code) {
      isRemoteUpdate.current = true;
      const position = editorRef.current.getPosition();
      editorRef.current.setValue(code);
      if (position) editorRef.current.setPosition(position);
      isRemoteUpdate.current = false;
    }
  }, [code]);

  const handleEditorMount = (editor) => {
    editorRef.current = editor;

    if (code !== undefined && code !== null && code !== "") {
      console.log("🟢 [Liveblocks] Setting initial value from storage");
      editor.setValue(code);
    } else {
      console.log("🟢 [Liveblocks] Storage is empty at mount - starting blank");
    }
  };

  const handleChange = (value) => {
    if (isRemoteUpdate.current) {
      return;
    }
    const newCode = value || "";
    setCode(newCode);
    onCodeChange?.(newCode);
  };

  return (
    <div className="relative h-full">

      <Editor
        height="100%"
        language={language}
        onMount={handleEditorMount}
        onChange={handleChange}
        theme="vs-dark"
        options={{
          fontSize: 16,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          minimap: { enabled: false },
          ...options,
        }}
      />
    </div>
  );
}

export default CollaborativeEditor;