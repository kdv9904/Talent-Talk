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