import Editor from "@monaco-editor/react";
import { useOthers, useStorage, useMutation } from "../liveblocks.config";
import { useEffect, useRef } from "react";

function CollaborativeEditor({ language, onCodeChange, options = {} }) {
  const others = useOthers();
  const editorRef = useRef(null);
  const isRemoteUpdate = useRef(false);

  // Read shared code from Liveblocks storage
  const code = useStorage((root) => root.code);

  console.log("🔵 [Liveblocks] useStorage code value:", JSON.stringify(code));
  console.log("🔵 [Liveblocks] others connected:", others.length, others.map(o => o.id));

  // Write shared code to Liveblocks storage
  const setCode = useMutation(({ storage }, newCode) => {
    console.log("✏️ [Liveblocks] Writing to storage:", newCode?.slice(0, 50));
    storage.set("code", newCode);
    console.log("✏️ [Liveblocks] Storage after set:", storage.get("code")?.slice(0, 50));
  }, []);

  // When remote storage changes, update Monaco editor content
  useEffect(() => {
    console.log("🔄 [Liveblocks] code changed in storage:", JSON.stringify(code?.slice(0, 50)));
    console.log("🔄 [Liveblocks] editorRef exists:", !!editorRef.current);

    if (!editorRef.current || code === undefined || code === null) {
      console.warn("⚠️ [Liveblocks] Skipping editor update - editor not ready or code is null/undefined");
      return;
    }

    const currentValue = editorRef.current.getValue();
    console.log("🔄 [Liveblocks] currentValue vs storage code match:", currentValue === code);

    if (currentValue !== code) {
      console.log("🔄 [Liveblocks] Updating editor with remote content");
      isRemoteUpdate.current = true;
      const position = editorRef.current.getPosition();
      editorRef.current.setValue(code);
      if (position) editorRef.current.setPosition(position);
      isRemoteUpdate.current = false;
    }
  }, [code]);

  const handleEditorMount = (editor) => {
    console.log("🟢 [Liveblocks] Editor mounted");
    editorRef.current = editor;
    console.log("🟢 [Liveblocks] code in storage at mount time:", JSON.stringify(code?.slice(0, 50)));

    if (code !== undefined && code !== null && code !== "") {
      console.log("🟢 [Liveblocks] Setting initial value from storage");
      editor.setValue(code);
    } else {
      console.log("🟢 [Liveblocks] Storage is empty at mount - starting blank");
    }
  };

  const handleChange = (value) => {
    if (isRemoteUpdate.current) {
      console.log("🚫 [Liveblocks] Skipping handleChange - is remote update");
      return;
    }
    const newCode = value || "";
    console.log("⌨️ [Liveblocks] Local change, writing to storage:", newCode?.slice(0, 30));
    setCode(newCode);
    onCodeChange?.(newCode);
  };

  return (
    <div className="relative h-full">
      {/* Debug overlay */}
      <div className="absolute bottom-2 left-2 z-10 bg-black/70 text-green-400 text-xs p-2 rounded font-mono max-w-xs">
        <div>🔵 Storage code: {code === null ? "null" : code === undefined ? "undefined" : `"${code?.slice(0, 20)}..."`}</div>
        <div>👥 Others: {others.length}</div>
        <div>📝 Editor ready: {editorRef.current ? "yes" : "no"}</div>
      </div>

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