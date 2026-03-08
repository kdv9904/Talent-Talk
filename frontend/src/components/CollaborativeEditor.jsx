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
    if (!editorRef.current || code === undefined || code === null) return;

    const currentValue = editorRef.current.getValue();
    if (currentValue !== code) {
      isRemoteUpdate.current = true;
      const position = editorRef.current.getPosition();
      editorRef.current.setValue(code);
      // Restore cursor position after remote update
      if (position) {
        editorRef.current.setPosition(position);
      }
      isRemoteUpdate.current = false;
    }
  }, [code]);

  const handleEditorMount = (editor) => {
    editorRef.current = editor;
    // Set initial value from storage if it exists
    if (code !== undefined && code !== null && code !== "") {
      editor.setValue(code);
    }
  };

  const handleChange = (value) => {
    if (isRemoteUpdate.current) return;
    const newCode = value || "";
    setCode(newCode);
    onCodeChange?.(newCode);
  };

  return (
    <div className="relative h-full">
      {others.length > 0 && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-base-300/80 rounded-full px-3 py-1 text-xs">
          <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
          {others.length} other{others.length > 1 ? "s" : ""} editing
        </div>
      )}

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