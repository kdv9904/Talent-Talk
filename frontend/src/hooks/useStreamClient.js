import { useState, useEffect, useRef } from "react";
import { StreamChat } from "stream-chat";
import toast from "react-hot-toast";
import { initializeStreamClient } from "../lib/stream";
import { sessionApi } from "../api/sessions";

function useStreamClient(session, loadingSession, isHost, isParticipant) {
  const [streamClient, setStreamClient] = useState(null);
  const [call, setCall] = useState(null);
  const [chatClient, setChatClient] = useState(null);
  const [channel, setChannel] = useState(null);
  const [isInitializingCall, setIsInitializingCall] = useState(true);

  const initializedRef = useRef(false);
  const callIdRef = useRef(null);

  useEffect(() => {
    sessionApi.getStreamToken().catch(() => {});
  }, []);

  useEffect(() => {
    let videoCall = null;

    const initCall = async () => {
      if (!session?.callId) return;
      if (!isHost && !isParticipant) return;
      if (session.status === "completed") return;

      if (initializedRef.current && callIdRef.current === session.callId) return;

      initializedRef.current = true;
      callIdRef.current = session.callId;

      try {
        const { token, userId, userName, userImage } =
          await sessionApi.getStreamToken();

        const client = await initializeStreamClient(
          { id: userId, name: userName, image: userImage },
          token
        );

        setStreamClient(client);

        videoCall = client.call("default", session.callId);

        await videoCall.join({ create: true });

        setCall(videoCall);

        /* ---------------- CHAT INIT ---------------- */

        const apiKey = import.meta.env.VITE_STREAM_API_KEY;
        const chatClientInstance = StreamChat.getInstance(apiKey);

        if (!chatClientInstance.userID) {
          await chatClientInstance.connectUser(
            { id: userId, name: userName, image: userImage },
            token
          );
        }

        setChatClient(chatClientInstance);

        const chatChannel = chatClientInstance.channel(
          "messaging",
          session.callId
        );

        await chatChannel.watch();
        setChannel(chatChannel);
      } catch (error) {
        toast.error("Failed to join video call");
        console.error("Stream init error:", error);
        initializedRef.current = false;
      } finally {
        setIsInitializingCall(false);
      }
    };

    if (session && !loadingSession) {
      initCall();
    }

    return () => {
      if (videoCall) {
        videoCall.leave().catch(() => {});
      }
    };
  }, [session?.callId, session?.status, isHost, isParticipant, loadingSession]);

  /* --------------- CLEANUP ONLY ON PAGE EXIT --------------- */

  useEffect(() => {
    return () => {
      const cleanup = async () => {
        try {
          if (chatClient) await chatClient.disconnectUser();
          if (streamClient) await streamClient.disconnectUser();
        } catch (err) {
          console.error("Stream cleanup error:", err);
        }
      };

      cleanup();
    };
  }, []);

  return { streamClient, call, chatClient, channel, isInitializingCall };
}

export default useStreamClient;
