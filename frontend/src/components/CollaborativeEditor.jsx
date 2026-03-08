import { useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import * as Y from "yjs";
import { LiveblocksYjsProvider } from "@liveblocks/yjs";
import { MonacoBinding } from "y-monaco";
import { useRoom, useOthers } from "../liveblocks.config";

function CollaborativeEditor({ language, onCodeChange, options = {} }) {
  const room = useRoom();
  const others = useOthers();
  const editorRef = useRef(null);
  const bindingRef = useRef(null);
  const providerRef = useRef(null);
  const docRef = useRef(null);

  useEffect(() => {
    if (!room || !editorRef.current) return;

    // Create Yjs document and Liveblocks provider
    const doc = new Y.Doc();
    const provider = new LiveblocksYjsProvider(room, doc);
    const yText = doc.getText("monaco");

    docRef.current = doc;
    providerRef.current = provider;

    // Bind Monaco editor to Yjs text
    const model = editorRef.current.getModel();
    if (model) {
      const binding = new MonacoBinding(
        yText,
        model,
        new Set([editorRef.current]),
        provider.awareness
      );
      bindingRef.current = binding;

      // Fire onCodeChange whenever the shared text changes
      yText.observe(() => {
        onCodeChange?.(yText.toString());
      });
    }

    return () => {
      bindingRef.current?.destroy();
      providerRef.current?.destroy();
      docRef.current?.destroy();
    };
  }, [room]);

  // When language changes, update the model language
  const handleEditorMount = (editor) => {
    editorRef.current = editor;
  };

  return (
    <div className="relative h-full">
      {/* Online users indicator */}
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