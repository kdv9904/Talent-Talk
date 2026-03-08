import {
  CallControls,
  CallingState,
  SpeakerLayout,
  useCallStateHooks,
  useCall,
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

  // AI Feedback state for participants
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [aiFeedback, setAiFeedback] = useState(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const call = useCall();
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recordingChunks, setRecordingChunks] = useState([]);

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
  }, [isHR, session]);

  // Handle leave — show AI feedback first, then navigate
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

    // Participant: show AI feedback modal first
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

  const handlePermissionAction = async (participantId, action) => {
    if (!participantId) {
      alert("Error: Invalid participant ID");
      return;
    }

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
        },
      );

      if (response.ok) {
        setParticipantsData((prev) =>
          prev.map((p) =>
            p.id === participantId ? { ...p, tabSwitchAllowed: action } : p,
          ),
        );

        if (channel) {
          const participant = participantsData.find(
            (p) => p.id === participantId,
          );
          await channel.sendMessage({
            text: `🔓 HR ${
              action ? "granted" : "revoked"
            } tab switching permission for ${
              participant?.name || "a participant"
            }.`,
          });
        }

        alert(`Permission ${action ? "granted" : "revoked"} successfully!`);
      } else {
        const errorData = await response.json();
        alert(
          `Failed to update permission: ${
            errorData.message || "Unknown error"
          }`,
        );
      }
    } catch (error) {
      console.error("Failed to update permission:", error);
      alert("Error updating permission. Please check console for details.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkPermission = async (action) => {
    if (
      !confirm(
        `Are you sure you want to ${
          action ? "grant" : "revoke"
        } tab switch permission for all participants?`,
      )
    ) {
      return;
    }

    setActionLoading("bulk");
    try {
      for (const participant of participantsData) {
        await handlePermissionAction(participant.id, action);
      }
    } catch (error) {
      console.error("Bulk permission update failed:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredParticipants = participantsData.filter(
    (participant) =>
      participant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      participant.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (callingState === CallingState.JOINING) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2Icon className="w-12 h-12 mx-auto animate-spin text-primary mb-4" />
          <p className="text-lg">Joining call...</p>
        </div>
      </div>
    );
  }

  const startLocalRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `session-${sessionId}-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      console.error("Recording failed:", err);
      alert("❌ Recording failed. Please allow screen sharing.");
    }
  };

  const stopLocalRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setMediaRecorder(null);
    }
  };

  const handleRecording = () => {
    if (isRecording) stopLocalRecording();
    else startLocalRecording();
  };

  return (
    <div className="h-full flex gap-3 relative str-video">
      <div className="flex-1 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 bg-base-100 p-3 rounded-lg shadow">
          <div className="flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-primary" />
            <span className="font-semibold">
              {participantCount}{" "}
              {participantCount === 1 ? "participant" : "participants"}
            </span>
            {isRecording && (
              <div className="flex items-center gap-1 badge badge-error badge-sm animate-pulse">
                <span className="w-2 h-2 bg-white rounded-full inline-block"></span>
                Recording
              </div>
            )}
            {!isHR && (
              <div
                className={`badge ${
                  hasTabSwitchPermission ? "badge-success" : "badge-warning"
                } badge-sm`}
              >
                {hasTabSwitchPermission
                  ? "Tab Access Allowed"
                  : "Tab Access Restricted"}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isHR && (
              <button
                onClick={() => setIsManagingPermissions(!isManagingPermissions)}
                className={`btn btn-sm gap-2 ${
                  isManagingPermissions ? "btn-warning" : "btn-info"
                }`}
              >
                <ShieldIcon className="size-4" />
                {isManagingPermissions ? "Managing Permissions" : "HR Controls"}
              </button>
            )}

            {chatClient && channel && (
              <button
                onClick={() => setIsChatOpen(!isChatOpen)}
                className={`btn btn-sm gap-2 ${
                  isChatOpen ? "btn-primary" : "btn-ghost"
                }`}
              >
                <MessageSquareIcon className="size-4" />
                Chat
              </button>
            )}
          </div>
        </div>

        {/* HR PERMISSION MANAGEMENT PANEL */}
        {isHR && isManagingPermissions && (
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldIcon className="w-5 h-5 text-warning" />
                <h3 className="font-semibold text-warning-content">
                  HR Permission Management
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge badge-sm badge-warning">
                  {participantsData.length} Participants
                </span>
                <button
                  onClick={() => setIsManagingPermissions(false)}
                  className="btn btn-ghost btn-sm"
                >
                  <XIcon className="size-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <SearchIcon className="absolute left-3 top-3 w-4 h-4 opacity-50" />
                  <input
                    type="text"
                    placeholder="Search participants..."
                    className="input input-bordered w-full pl-10 input-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => handleBulkPermission(true)}
                  disabled={actionLoading === "bulk"}
                  className="btn btn-success btn-sm gap-2"
                >
                  {actionLoading === "bulk" ? (
                    <Loader2Icon className="w-4 h-4 animate-spin" />
                  ) : (
                    <UnlockIcon className="size-4" />
                  )}
                  Allow All
                </button>
                <button
                  onClick={() => handleBulkPermission(false)}
                  disabled={actionLoading === "bulk"}
                  className="btn btn-error btn-sm gap-2"
                >
                  {actionLoading === "bulk" ? (
                    <Loader2Icon className="w-4 h-4 animate-spin" />
                  ) : (
                    <LockIcon className="size-4" />
                  )}
                  Revoke All
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2">
                {participantsData.length === 0 ? (
                  <div className="text-center py-4 text-warning-content/70">
                    <AlertCircleIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">
                      No participants found in this session
                    </p>
                    <p className="text-xs opacity-70">
                      Participants will appear here when they join
                    </p>
                  </div>
                ) : filteredParticipants.length > 0 ? (
                  filteredParticipants.map((participant) => (
                    <div
                      key={participant.id}
                      className="flex items-center justify-between p-3 bg-base-200 rounded-lg border border-base-300"
                    >
                      <div className="flex items-center gap-3">
                        <div className="avatar">
                          <div className="w-10 h-10 rounded-full bg-primary text-primary-content flex items-center justify-center text-sm">
                            {participant.profileImage ? (
                              <img
                                src={participant.profileImage}
                                alt={participant.name}
                                className="rounded-full w-full h-full object-cover"
                              />
                            ) : (
                              <UserIcon className="w-5 h-5" />
                            )}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">
                              {participant.name}
                            </p>
                            {participant.isOnline && (
                              <div
                                className="w-2 h-2 bg-success rounded-full"
                                title="Online"
                              />
                            )}
                          </div>
                          <p className="text-xs opacity-70 truncate">
                            {participant.email}
                          </p>
                          {participant.violations.length > 0 && (
                            <p className="text-xs text-error">
                              {participant.violations.length} violation(s)
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div
                          className={`badge badge-sm ${
                            participant.tabSwitchAllowed
                              ? "badge-success"
                              : "badge-warning"
                          }`}
                        >
                          {participant.tabSwitchAllowed
                            ? "Allowed"
                            : "Restricted"}
                        </div>
                        {participant.tabSwitchAllowed ? (
                          <button
                            onClick={() =>
                              handlePermissionAction(participant.id, false)
                            }
                            disabled={actionLoading === participant.id}
                            className="btn btn-error btn-xs gap-1"
                          >
                            {actionLoading === participant.id ? (
                              <Loader2Icon className="w-3 h-3 animate-spin" />
                            ) : (
                              <LockIcon className="w-3 h-3" />
                            )}
                            Revoke
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              handlePermissionAction(participant.id, true)
                            }
                            disabled={actionLoading === participant.id}
                            className="btn btn-success btn-xs gap-1"
                          >
                            {actionLoading === participant.id ? (
                              <Loader2Icon className="w-3 h-3 animate-spin" />
                            ) : (
                              <UnlockIcon className="w-3 h-3" />
                            )}
                            Allow
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-warning-content/70">
                    <SearchIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No participants match your search</p>
                  </div>
                )}
              </div>

              <div className="bg-base-300 rounded p-2 mt-2">
                <details className="text-xs">
                  <summary className="cursor-pointer">Debug Info</summary>
                  <div className="mt-1 space-y-1">
                    <p>Session ID: {sessionId}</p>
                    <p>Total Participants: {participantsData.length}</p>
                    <p>Video Participants: {videoParticipants.length}</p>
                    <p>
                      With Permission:{" "}
                      {
                        participantsData.filter((p) => p.tabSwitchAllowed)
                          .length
                      }
                    </p>
                  </div>
                </details>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 bg-base-300 rounded-lg overflow-hidden relative">
          <SpeakerLayout />
        </div>

        <div className="bg-base-100 p-3 rounded-lg shadow flex justify-center">
          <div className="bg-base-100 p-3 rounded-lg shadow flex justify-center items-center gap-3">
  <CallControls onLeave={handleLeave} />
  <button
    onClick={handleRecording}
    className={`btn btn-sm gap-2 ${isRecording ? 'btn-error animate-pulse' : 'btn-ghost border border-base-300'}`}
    title={isRecording ? 'Stop Recording' : 'Start Recording'}
  >
    <span className={`w-3 h-3 rounded-full ${isRecording ? 'bg-white' : 'bg-error'}`} />
    {isRecording ? 'Stop' : 'Record'}
  </button>
</div>
        </div>
      </div>

      {/* CHAT SECTION */}
      {chatClient && channel && (
        <div
          className={`flex flex-col rounded-lg shadow overflow-hidden bg-[#272a30] transition-all duration-300 ease-in-out ${
            isChatOpen ? "w-80 opacity-100" : "w-0 opacity-0"
          }`}
        >
          {isChatOpen && (
            <>
              <div className="bg-[#1c1e22] p-3 border-b border-[#3a3d44] flex items-center justify-between">
                <h3 className="font-semibold text-white">Session Chat</h3>
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <XIcon className="size-5" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden stream-chat-dark">
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
            </>
          )}
        </div>
      )}

      {/* AI FEEDBACK MODAL */}
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