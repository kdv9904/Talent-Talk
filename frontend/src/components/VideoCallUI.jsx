import {
  CallControls,
  CallingState,
  SpeakerLayout,
  useCallStateHooks,
} from "@stream-io/video-react-sdk";
import {
  Loader2Icon,
  MessageSquareIcon,
  UsersIcon,
  XIcon,
  ShieldIcon,
  UnlockIcon,
  LockIcon,
  UserIcon,
  SearchIcon,
  AlertCircleIcon,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@clerk/clerk-react";
import {
  Channel,
  Chat,
  MessageInput,
  MessageList,
  Thread,
  Window,
} from "stream-chat-react";

import { sessionApi } from "../api/sessions";
import AIFeedbackModal from "./AIFeedbackModal";

import "@stream-io/video-react-sdk/dist/css/styles.css";
import "stream-chat-react/dist/css/v2/index.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function VideoCallUI({
  chatClient,
  channel,
  isHR,
  isAdmin,
  sessionId,
  participantCount,
  maxParticipants,
  hasTabSwitchPermission,
  session,
  code,
  language,
}) {
  const navigate = useNavigate();
  const { getToken } = useAuth();

  const { useCallCallingState, useParticipants } = useCallStateHooks();
  const callingState = useCallCallingState();
  const videoParticipants = useParticipants();

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isManagingPermissions, setIsManagingPermissions] = useState(false);
  const [participantsData, setParticipantsData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionLoading, setActionLoading] = useState(null);

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [aiFeedback, setAiFeedback] = useState(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [screenStream, setScreenStream] = useState(null);

  useEffect(() => {
    if (isHR && session?.participants) {
      const formattedParticipants = session.participants.map((p) => ({
        id: p.user?._id,
        clerkId: p.user?.clerkId,
        name: p.user?.name || "Unknown User",
        email: p.user?.email || "No email",
        profileImage: p.user?.profileImage,
        tabSwitchAllowed: p.tabSwitchAllowed || false,
        violations: p.violations || [],
        isOnline: videoParticipants.some((vp) => vp.userId === p.user?.clerkId),
      }));

      setParticipantsData(formattedParticipants);
    }
  }, [isHR, session, videoParticipants]);

  /* -------------------------------- LEAVE SESSION -------------------------------- */

  const handleLeave = async () => {
    if (isHR) {
      try {
        const token = await getToken();
        await fetch(`${API_BASE_URL}/sessions/${sessionId}/leave`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (err) {
        console.error("Leave session error:", err);
      }

      navigate("/dashboard");
      return;
    }

    setShowFeedbackModal(true);
    setFeedbackLoading(true);

    try {
      const result = await sessionApi.getAIFeedback(sessionId, {
        code,
        language,
        problem: session?.problem,
      });

      setAiFeedback(result.feedback);
    } catch (err) {
      console.error("AI feedback error:", err);
      setAiFeedback(null);
    } finally {
      setFeedbackLoading(false);
    }
  };

  const confirmLeave = async () => {
    try {
      const token = await getToken();
      await fetch(`${API_BASE_URL}/sessions/${sessionId}/leave`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.error("Leave session error:", err);
    }

    navigate("/dashboard");
  };

  /* ------------------------------ LOCAL RECORDING -------------------------------- */

  const startLocalRecording = async () => {
    try {
      console.log("Starting screen recording...");

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      recorder.onstop = () => {
        console.log("Recording stopped");

        const blob = new Blob(chunks, { type: "video/webm" });

        if (!blob.size) {
          console.error("No recording data");
          alert("Recording failed");
          return;
        }

        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `session-${sessionId}-${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);

        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        setMediaRecorder(null);
        setScreenStream(null);
      };

      recorder.start();

      setScreenStream(stream);
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error) {
      console.error("Recording error:", error);
      alert("Screen recording permission denied.");
    }
  };

  const stopLocalRecording = () => {
    if (mediaRecorder) {
      console.log("Stopping recording...");
      mediaRecorder.stop();
    }
  };

  const handleRecording = () => {
    if (!isHR && !isAdmin) {
      console.warn("Only HR/Admin can record");
      return;
    }

    if (isRecording) stopLocalRecording();
    else startLocalRecording();
  };

  /* ----------------------------- PERMISSION ACTION ------------------------------ */

  const handlePermissionAction = async (participantId, action) => {
    if (!participantId) return;

    setActionLoading(participantId);

    try {
      const token = await getToken();

      const response = await fetch(
        `${API_BASE_URL}/sessions/${sessionId}/grant-permission`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            userId: participantId,
            permission: action ? "grant" : "revoke",
          }),
        }
      );

      if (response.ok) {
        setParticipantsData((prev) =>
          prev.map((p) =>
            p.id === participantId ? { ...p, tabSwitchAllowed: action } : p
          )
        );
      }
    } catch (error) {
      console.error("Permission update failed:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredParticipants = participantsData.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  /* ------------------------------- LOADING STATE -------------------------------- */

  if (callingState === CallingState.JOINING) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2Icon className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  /* ------------------------------------ UI ------------------------------------- */

  return (
    <div className="h-full flex gap-3 relative str-video">
      <div className="flex-1 flex flex-col gap-3">

        <div className="flex items-center justify-between bg-base-100 p-3 rounded-lg shadow">
          <div className="flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-primary" />
            <span className="font-semibold">
              {participantCount} participants
            </span>

            {isRecording && (
              <div className="badge badge-error badge-sm animate-pulse">
                Recording
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {chatClient && channel && (
              <button
                onClick={() => setIsChatOpen(!isChatOpen)}
                className="btn btn-sm btn-ghost"
              >
                <MessageSquareIcon className="size-4" />
                Chat
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 bg-base-300 rounded-lg overflow-hidden">
          <SpeakerLayout />
        </div>

        <div className="bg-base-100 p-3 rounded-lg shadow flex justify-center gap-3">
          <CallControls onLeave={handleLeave} />

          {(isHR || isAdmin) && (
            <button
              onClick={handleRecording}
              className={`btn btn-sm gap-2 ${
                isRecording ? "btn-error animate-pulse" : "btn-outline"
              }`}
            >
              <span
                className={`w-3 h-3 rounded-full ${
                  isRecording ? "bg-white" : "bg-red-500"
                }`}
              />
              {isRecording ? "Stop" : "Record"}
            </button>
          )}
        </div>
      </div>

      {chatClient && channel && isChatOpen && (
        <div className="w-80 bg-[#272a30] rounded-lg shadow">
          <Chat client={chatClient} theme="str-chat__theme-dark">
            <Channel channel={channel}>
              <Window>
                <MessageList />
                <MessageInput />
              </Window>
              <Thread />
            </Channel>
          </Chat>
        </div>
      )}

      <AIFeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        feedback={aiFeedback}
        isLoading={feedbackLoading}
        onConfirmEnd={confirmLeave}
        isParticipant={true}
      />
    </div>
  );
}

export default VideoCallUI;
