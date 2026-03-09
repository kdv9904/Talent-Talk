import { useUser, useAuth } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  useEndSession,
  useJoinSession,
  useSessionById,
} from "../hooks/useSessions";
import { PROBLEMS } from "../data/problems";
import { executeCode } from "../lib/piston";
import Navbar from "../components/Navbar";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { getDifficultyBadgeClass } from "../lib/utils";
import {
  Loader2Icon,
  LogOutIcon,
  PhoneOffIcon,
  AlertTriangleIcon,
  UsersIcon,
} from "lucide-react";
import CodeEditorPanel from "../components/CodeEditorPanel";
import OutputPanel from "../components/OutputPanel";
import { useUserRole } from "../hooks/useUserRole";
import { useBotDetection } from "../hooks/useBotDetection";

import useStreamClient from "../hooks/useStreamClient";
import { StreamCall, StreamVideo } from "@stream-io/video-react-sdk";
import VideoCallUI from "../components/VideoCallUI";
import AIFeedbackModal from "../components/AIFeedbackModal";
import { sessionApi } from "../api/sessions";
import { RoomProvider } from "../liveblocks.config";

function SessionPage() {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useUser();
  const { isHR, userRole, isAdmin, loading: roleLoading } = useUserRole();
  const [output, setOutput] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const { getToken } = useAuth();
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
const [aiFeedback, setAiFeedback] = useState(null);
const [feedbackLoading, setFeedbackLoading] = useState(false);
  

  // Load tabSwitchCount from localStorage (persist across refresh)
  const [tabSwitchCount, setTabSwitchCount] = useState(() => {
    try {
      const saved =
        typeof window !== "undefined"
          ? localStorage.getItem(`tabSwitch_${id}`)
          : null;
      return saved ? parseInt(saved, 10) : 0;
    } catch (error) {
      console.error("Error parsing tab switch count from localStorage:", error);
      return 0;
    }
  });
  const [showTabWarning, setShowTabWarning] = useState(false);

  // New state for tab switch permission
  const [hasTabSwitchPermission, setHasTabSwitchPermission] = useState(false);

  const {
    data: sessionData,
    isLoading: loadingSession,
    refetch,
  } = useSessionById(id);

  const joinSessionMutation = useJoinSession();
  const endSessionMutation = useEndSession();

  const session = sessionData?.session;

  // Updated participant logic for 4 participants
  const isHost = session?.host?.clerkId === user?.id;
  const isParticipant = session?.participants?.some(
    (p) => p.user?.clerkId === user?.id,
  );
  const canAccessCall = isHost || isParticipant || isHR;
  const participantCount = session?.participants
    ? session.participants.length + 1
    : 1; // +1 for host
  const maxParticipants = session?.maxParticipants || 4;
  const isFull = participantCount >= maxParticipants;
  const canJoin = !isHost && !isParticipant && !isFull;

  const { call, channel, chatClient, isInitializingCall, streamClient } =
    useStreamClient(session, loadingSession, isHost, isParticipant || isHR);

  // Add bot detection
  const { violations: botViolations } = useBotDetection(id, isHR);


  useEffect(() => {
  if (!session || !user || isHR || session.status !== "active") return;
  
  const check = async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/sessions/${id}/tab-permission`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setHasTabSwitchPermission(data.hasPermission ?? false);
      }
    } catch (error) {
      console.error("Error checking tab switch permission:", error);
    }
  };

  check();
  const intervalId = setInterval(check, 3000);
  return () => clearInterval(intervalId);
}, [session?.status, id, isHR, user?.id]);
  // Sync localStorage changes across tabs (storage event)
  useEffect(() => {
    const onStorage = (e) => {
      try {
        if (!e) return;
        if (e.key === `tabSwitch_${id}`) {
          const val = e.newValue ? parseInt(e.newValue, 10) : 0;
          setTabSwitchCount(val);
        }
      } catch (error) {
        console.error(
          "Error parsing tab switch count from localStorage:",
          error,
        );
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [id]);

  // TAB SWITCHING DETECTION - ONLY FOR NON-HR USERS WITHOUT PERMISSION
  useEffect(() => {
    // Skip if user has permission, is HR, or session is not active
    if (
      hasTabSwitchPermission ||
      isHR ||
      !session ||
      session.status !== "active"
    ) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Use functional update to avoid stale closure
        setTabSwitchCount((prev) => {
          const newCount = prev + 1;

          // persist to localStorage
          try {
            localStorage.setItem(`tabSwitch_${id}`, String(newCount));
          } catch (error) {
            console.error(
              "Error saving tab switch count to localStorage:",
              error,
            );
          }

          // UI
          setShowTabWarning(true);

          // server log (fire-and-forget)
          getToken().then(token => {
  fetch(`${API_BASE_URL}/sessions/${id}/violation`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}` // ✅
    },
    body: JSON.stringify({
      type: "tab_switch",
      userId: user?.id,
      count: newCount,
      details: `Tab switch detected - count: ${newCount}`
    })
  }).catch(console.error);
});

          if (newCount >= 2) {
            // inform user then kick/redirect
            setTimeout(() => {
              try {
                alert(
                  "❌ You have been removed from the session due to multiple tab switches.",
                );
              } catch (error) {
                console.error(error);
              }
            }, 100);

            setTimeout(() => {
              // clear stored count for this session
              try {
                localStorage.removeItem(`tabSwitch_${id}`);
              } catch (err) {
                console.error(
                  "Error clearing tab switch count from localStorage:",
                  err,
                );
              }
              navigate("/dashboard");
            }, 2000);
          } else {
            setTimeout(() => {
              try {
                alert(`⚠️ Tab switching is not allowed! Warning ${newCount}/2`);
              } catch (e) {
                console.error(e);
              }
            }, 100);

            setTimeout(() => setShowTabWarning(false), 2000);
          }

          return newCount;
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isHR, session, id, user?.id, navigate, hasTabSwitchPermission]);

  
  useEffect(() => {

   // Allow copying FROM editor, block copying from question
const handleCopy = (e) => {
  const isFromEditor = e.target.closest(".monaco-editor") || e.target.closest(".CodeEditorPanel");
  if (!isFromEditor) {
    e.preventDefault();
    setTimeout(() => alert("❌ Copying disabled during session!"), 100);
  }
};

// Block paste EVERYWHERE including editor
const handlePaste = (e) => {
  e.preventDefault();
  setTimeout(() => alert("❌ Pasting disabled during session!"), 100);
};

// Block cut everywhere
const handleCut = (e) => {
  e.preventDefault();
  setTimeout(() => alert("❌ Cutting disabled during session!"), 100);
};

    const handleContextMenu = (e) => {
      const isFromEditor =
        e.target.closest(".monaco-editor") ||
        e.target.closest(".CodeEditorPanel");
      if (!isFromEditor) {
        e.preventDefault();
        setTimeout(() => alert("❌ Right-click disabled during session!"), 100);
      }
    };

    const handleSelectStart = (e) => {
      const isFromEditor =
        e.target.closest(".monaco-editor") ||
        e.target.closest(".CodeEditorPanel");
      if (!isFromEditor) {
        e.preventDefault();
      }
    };

    // Block paste specifically inside Monaco editor textarea
    const handleMonacoPaste = (e) => {
      e.stopPropagation();
      e.preventDefault();
      setTimeout(() => alert("❌ Pasting disabled during session!"), 100);
    };

    // ── 2. Cleanup function — references all handlers defined above ────────────
    const cleanupRestrictions = () => {
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("cut", handleCut);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("selectstart", handleSelectStart);

      // Remove Monaco paste listeners
      document.querySelectorAll('.monaco-editor .inputarea').forEach(el => {
        el.removeEventListener('paste', handleMonacoPaste);
      });

      // Remove injected styles
      const styleElement = document.getElementById("smart-restrictions");
      if (styleElement) styleElement.remove();
    };

    // ── 3. Skip restrictions if HR or user has permission ─────────────────────
    if (
      hasTabSwitchPermission ||
      isHR ||
      !session ||
      session.status !== "active"
    ) {
      cleanupRestrictions();
      return cleanupRestrictions;
    }

    // ── 4. Add document-level event listeners ─────────────────────────────────
    document.addEventListener("copy", handleCopy);
    document.addEventListener("cut", handleCut);
    document.addEventListener("paste", handlePaste);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("selectstart", handleSelectStart);

    // ── 5. Add Monaco-specific paste blocker (with delay for editor to mount) ──
    setTimeout(() => {
      document.querySelectorAll('.monaco-editor .inputarea').forEach(el => {
        el.addEventListener('paste', handleMonacoPaste);
      });
    }, 1000);

    // ── 6. Inject CSS ──────────────────────────────────────────────────────────
    const style = document.createElement("style");
    style.id = "smart-restrictions";
    style.textContent = `
      * {
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
      }
      .monaco-editor *, .monaco-editor,
      [data-testid="code-editor"] *, .CodeEditorPanel * {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        user-select: text !important;
      }
      ::selection { background: transparent !important; }
      ::-moz-selection { background: transparent !important; }
      .monaco-editor ::selection { background: #0078d4 !important; }
      .monaco-editor ::-moz-selection { background: #0078d4 !important; }
    `;
    document.head.appendChild(style);

    // ── 7. Override clipboard API ──────────────────────────────────────────────
    if (navigator.clipboard && navigator.clipboard.writeText) {
      const originalWriteText = navigator.clipboard.writeText;
      navigator.clipboard.writeText = function (text) {
        const activeElement = document.activeElement;
        const isFromEditor =
          activeElement &&
          (activeElement.closest(".monaco-editor") ||
            activeElement.closest(".CodeEditorPanel"));
        if (!isFromEditor) {
          setTimeout(() => alert("❌ Clipboard access disabled during session!"), 100);
          return Promise.reject(new Error("Clipboard disabled"));
        }
        return originalWriteText.call(this, text);
      };
    }

    return cleanupRestrictions;
  }, [isHR, session, hasTabSwitchPermission]);

  // find the problem data based on session problem title
  const problemData = session?.problem
    ? Object.values(PROBLEMS).find((p) => p.title === session.problem)
    : null;

  const [selectedLanguage, setSelectedLanguage] = useState("javascript");
  const [code, setCode] = useState(
    problemData?.starterCode?.[selectedLanguage] || "",
  );

  // auto-join session if user is not already a participant and not the host
  useEffect(() => {
    if (!session || !user || loadingSession) return;
    if (isHost || isParticipant || isFull) return;

    joinSessionMutation.mutate(id, { onSuccess: refetch });
  }, [session, user, loadingSession, isHost, isParticipant, isFull, id]);

  // redirect the "participant" when session ends
  useEffect(() => {
    if (!session || loadingSession) return;

    if (session.status === "completed") {
      // clear stored tab-switch count for this session
      try {
        localStorage.removeItem(`tabSwitch_${id}`);
      } catch (error) {
        console.error(
          "Error clearing tab switch count from localStorage:",
          error,
        );
      }
      navigate("/dashboard");
    }
  }, [session, loadingSession, navigate, id]);

  // update code when problem loads or changes
  useEffect(() => {
    if (problemData?.starterCode?.[selectedLanguage]) {
      setCode(problemData.starterCode[selectedLanguage]);
    }
  }, [problemData, selectedLanguage]);

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setSelectedLanguage(newLang);
    const starterCode = problemData?.starterCode?.[newLang] || "";
    setCode(starterCode);
    setOutput(null);
  };

  const handleRunCode = async () => {
    setIsRunning(true);
    setOutput(null);

    const result = await executeCode(selectedLanguage, code, getToken);
    setOutput(result);
    setIsRunning(false);
  };

  const handleEndSession = async () => {
  if (!confirm("End this session and get AI feedback on your code?")) return;
  
  setShowFeedbackModal(true);
  setFeedbackLoading(true);
  
  try {
    const result = await sessionApi.getAIFeedback(id, {
      code,
      language: selectedLanguage,
      problem: session?.problem
    });
    setAiFeedback(result.feedback);
  } catch (err) {
    setAiFeedback(null);
  } finally {
    setFeedbackLoading(false);
  }
};

const confirmEndSession = () => {
  try { localStorage.removeItem(`tabSwitch_${id}`); } catch {}
  endSessionMutation.mutate(id, { onSuccess: () => navigate("/dashboard") });
};

  return (
    <RoomProvider id={`session-${id}`} initialPresence={{}} initialStorage={{ code: "" }}>
    <div className="h-screen bg-base-100 flex flex-col">
      <Navbar />

      {/* BOT DETECTION WARNING BANNER */}
      {botViolations > 0 && !isHR && (
        <div className="bg-error text-error-content p-3 text-center font-semibold flex items-center justify-center gap-2">
          <span className="text-xl">🤖</span>
          AI/Bot Usage Detected! Violations: {botViolations}/3
          <span className="text-xl">🤖</span>
        </div>
      )}

      {/* TAB SWITCH WARNING BANNER */}
      {showTabWarning && !isHR && !hasTabSwitchPermission && (
        <div className="bg-warning text-warning-content p-3 text-center font-semibold flex items-center justify-center gap-2">
          <AlertTriangleIcon className="w-5 h-5" />
          Warning {tabSwitchCount}/2: Tab switching is not allowed during
          sessions!
          <AlertTriangleIcon className="w-5 h-5" />
        </div>
      )}

      <div className="flex-1">
        <PanelGroup direction="horizontal">
          {/* LEFT PANEL - CODE EDITOR & PROBLEM DETAILS */}
          <Panel defaultSize={50} minSize={30}>
            <PanelGroup direction="vertical">
              {/* PROBLEM DSC PANEL */}
              <Panel defaultSize={50} minSize={20}>
                <div className="h-full overflow-y-auto bg-base-200">
                  {/* HEADER SECTION */}
                  <div className="p-6 bg-base-100 border-b border-base-300">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h1 className="text-3xl font-bold text-base-content">
                          {session?.problem || "Loading..."}
                        </h1>
                        {problemData?.category && (
                          <p className="text-base-content/60 mt-1">
                            {problemData.category}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2 text-base-content/60">
                          <UsersIcon className="w-4 h-4" />
                          <span>
                            Host: {session?.host?.name || "Loading..."} •{" "}
                            {participantCount}/{maxParticipants} participants
                            {isFull && (
                              <span className="ml-2 text-error">• FULL</span>
                            )}
                          </span>
                        </div>
                        {/* Show participant list */}
                        {session?.participants &&
                          session.participants.length > 0 && (
                            <div className="mt-2 text-sm">
                              <span className="text-base-content/60">
                                Participants:{" "}
                              </span>
                              {session.participants.map((p, index) => (
                                <span
                                  key={p.user?._id || index}
                                  className="text-base-content/80"
                                >
                                  {p.user?.name}
                                  {index < session.participants.length - 1
                                    ? ", "
                                    : ""}
                                </span>
                              ))}
                            </div>
                          )}
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`badge badge-lg ${getDifficultyBadgeClass(
                            session?.difficulty,
                          )}`}
                        >
                          {session?.difficulty?.slice(0, 1).toUpperCase() +
                            session?.difficulty?.slice(1) || "Easy"}
                        </span>
                        {isHost && session?.status === "active" && (
                          <button
                            onClick={handleEndSession}
                            disabled={endSessionMutation.isPending}
                            className="btn btn-error btn-sm gap-2"
                          >
                            {endSessionMutation.isPending ? (
                              <Loader2Icon className="w-4 h-4 animate-spin" />
                            ) : (
                              <LogOutIcon className="w-4 h-4" />
                            )}
                            End Session
                          </button>
                        )}
                        {session?.status === "completed" && (
                          <span className="badge badge-ghost badge-lg">
                            Completed
                          </span>
                        )}
                        {canJoin && (
                          <span className="badge badge-success badge-sm">
                            Join Available
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* problem desc */}
                    {problemData?.description && (
                      <div className="bg-base-100 rounded-xl shadow-sm p-5 border border-base-300">
                        <h2 className="text-xl font-bold mb-4 text-base-content">
                          Description
                        </h2>
                        <div className="space-y-3 text-base leading-relaxed">
                          <p className="text-base-content/90">
                            {problemData.description.text}
                          </p>
                          {problemData.description.notes?.map((note, idx) => (
                            <p key={idx} className="text-base-content/90">
                              {note}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* examples section */}
                    {problemData?.examples &&
                      problemData.examples.length > 0 && (
                        <div className="bg-base-100 rounded-xl shadow-sm p-5 border border-base-300">
                          <h2 className="text-xl font-bold mb-4 text-base-content">
                            Examples
                          </h2>

                          <div className="space-y-4">
                            {problemData.examples.map((example, idx) => (
                              <div key={idx}>
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="badge badge-sm">
                                    {idx + 1}
                                  </span>
                                  <p className="font-semibold text-base-content">
                                    Example {idx + 1}
                                  </p>
                                </div>
                                <div className="bg-base-200 rounded-lg p-4 font-mono text-sm space-y-1.5">
                                  <div className="flex gap-2">
                                    <span className="text-primary font-bold min-w-[70px]">
                                      Input:
                                    </span>
                                    <span>{example.input}</span>
                                  </div>
                                  <div className="flex gap-2">
                                    <span className="text-secondary font-bold min-w-[70px]">
                                      Output:
                                    </span>
                                    <span>{example.output}</span>
                                  </div>
                                  {example.explanation && (
                                    <div className="pt-2 border-t border-base-300 mt-2">
                                      <span className="text-base-content/60 font-sans text-xs">
                                        <span className="font-semibold">
                                          Explanation:
                                        </span>{" "}
                                        {example.explanation}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Constraints */}
                    {problemData?.constraints &&
                      problemData.constraints.length > 0 && (
                        <div className="bg-base-100 rounded-xl shadow-sm p-5 border border-base-300">
                          <h2 className="text-xl font-bold mb-4 text-base-content">
                            Constraints
                          </h2>
                          <ul className="space-y-2 text-base-content/90">
                            {problemData.constraints.map((constraint, idx) => (
                              <li key={idx} className="flex gap-2">
                                <span className="text-primary">•</span>
                                <code className="text-sm">{constraint}</code>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>
                </div>
              </Panel>

              <PanelResizeHandle className="h-2 bg-base-300 hover:bg-primary transition-colors cursor-row-resize" />

              <Panel defaultSize={50} minSize={20}>
                <PanelGroup direction="vertical">
                  <Panel defaultSize={70} minSize={30}>
                    {/* Add CodeEditorPanel class for restrictions targeting */}
                    <div className="CodeEditorPanel h-full">
                      <CodeEditorPanel
  selectedLanguage={selectedLanguage}
  isRunning={isRunning}
  onLanguageChange={handleLanguageChange}
  onCodeChange={(value) => setCode(value)}
  onRunCode={handleRunCode}
/>
                    </div>
                  </Panel>

                  <PanelResizeHandle className="h-2 bg-base-300 hover:bg-primary transition-colors cursor-row-resize" />

                  <Panel defaultSize={30} minSize={15}>
                    <OutputPanel output={output} />
                  </Panel>
                </PanelGroup>
              </Panel>
            </PanelGroup>
          </Panel>

          <PanelResizeHandle className="w-2 bg-base-300 hover:bg-primary transition-colors cursor-col-resize" />

          {/* RIGHT PANEL - VIDEO CALLS & CHAT */}
          <Panel defaultSize={50} minSize={30}>
            <div className="h-full bg-base-200 p-4 overflow-auto">
              {isInitializingCall ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Loader2Icon className="w-12 h-12 mx-auto animate-spin text-primary mb-4" />
                    <p className="text-lg">Connecting to video call...</p>
                    <p className="text-sm text-base-content/50 mt-2">
                      This may take up to 30 seconds on first load
                    </p>
                  </div>
                </div>
              ) : !streamClient || !call ? (
                <div className="h-full flex items-center justify-center">
                  <div className="card bg-base-100 shadow-xl max-w-md">
                    <div className="card-body items-center text-center">
                      <div className="w-24 h-24 bg-error/10 rounded-full flex items-center justify-center mb-4">
                        <PhoneOffIcon className="w-12 h-12 text-error" />
                      </div>
                      <h2 className="card-title text-2xl">Connection Failed</h2>
                      <p className="text-base-content/70">
                        Unable to connect to the video call
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full">
                  <StreamVideo client={streamClient}>
                    <StreamCall call={call}>
                      <VideoCallUI
  chatClient={chatClient}
  channel={channel}
  isHR={isHR}
  isAdmin={isAdmin} 
  sessionId={id}
  participantCount={participantCount}
  maxParticipants={maxParticipants}
  hasTabSwitchPermission={hasTabSwitchPermission}
  session={session}
  roleLoading={roleLoading}
  code={code}
  language={selectedLanguage}
/>
                    </StreamCall>
                  </StreamVideo>
                </div>
              )}
            </div>
          </Panel>
        </PanelGroup>
      </div>
      <AIFeedbackModal
  isOpen={showFeedbackModal}
  onClose={() => setShowFeedbackModal(false)}
  feedback={aiFeedback}
  isLoading={feedbackLoading}
  onConfirmEnd={confirmEndSession}
/>
    </div>
    </RoomProvider>
  );
}

export default SessionPage;
