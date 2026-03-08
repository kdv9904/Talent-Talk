import { useState, useEffect, useRef } from "react";
import { StreamChat } from "stream-chat";
import toast from "react-hot-toast";
import { initializeStreamClient, disconnectStreamClient } from "../lib/stream";
import { sessionApi } from "../api/sessions";

function useStreamClient(session, loadingSession, isHost, isParticipant) {
  const [streamClient, setStreamClient] = useState(null);
  const [call, setCall] = useState(null);
  const [chatClient, setChatClient] = useState(null);
  const [channel, setChannel] = useState(null);
  const [isInitializingCall, setIsInitializingCall] = useState(true);

  // ✅ use ref to prevent re-init on every session refetch
  const initializedRef = useRef(false);
  const callIdRef = useRef(null);

  useEffect(() => {
  sessionApi.getStreamToken().catch(() => {}); // warm up, ignore errors
}, []);

  useEffect(() => {
    let videoCall = null;
    let chatClientInstance = null;

    const initCall = async () => {
      if (!session?.callId) return;
      if (!isHost && !isParticipant) return;
      if (session.status === "completed") return;

      // ✅ prevent re-initialization if callId hasn't changed
      if (initializedRef.current && callIdRef.current === session.callId) return;

      initializedRef.current = true;
      callIdRef.current = session.callId;

      try {
        // ✅ fetch token once
        const { token, userId, userName, userImage } = await sessionApi.getStreamToken();

        // ✅ initialize video client
        const client = await initializeStreamClient(
          { id: userId, name: userName, image: userImage },
          token
        );
        setStreamClient(client);

        // ✅ run video join + chat connect in PARALLEL instead of sequential
        videoCall = client.call("default", session.callId);

        const apiKey = import.meta.env.VITE_STREAM_API_KEY;
        chatClientInstance = StreamChat.getInstance(apiKey);

        await Promise.all([
          // join video call
          videoCall.join({ create: true }),

          // connect chat user
          chatClientInstance.userID
            ? Promise.resolve() // already connected, skip
            : chatClientInstance.connectUser(
                { id: userId, name: userName, image: userImage },
                token
              ),
        ]);

        setCall(videoCall);
        setChatClient(chatClientInstance);

        // watch chat channel
        const chatChannel = chatClientInstance.channel("messaging", session.callId);
        await chatChannel.watch();
        setChannel(chatChannel);

      } catch (error) {
        toast.error("Failed to join video call");
        console.error("Error init call", error);
        initializedRef.current = false; // allow retry on error
      } finally {
        setIsInitializingCall(false);
      }
    };

    if (session && !loadingSession) initCall();

    return () => {
      (async () => {
        try {
          if (videoCall) await videoCall.leave();
          if (chatClientInstance) await chatClientInstance.disconnectUser();
          await disconnectStreamClient();
        } catch (error) {
          console.error("Cleanup error:", error);
        }
      })();
    };
  }, [session?.callId, session?.status, isHost, isParticipant, loadingSession]); 
  // ✅ use session?.callId instead of full session object

  return { streamClient, call, chatClient, channel, isInitializingCall };
}

export default useStreamClient;