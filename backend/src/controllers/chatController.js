import { chatClient, streamClient } from "../lib/stream.js";

export async function getStreamToken(req, res) {
    try {
        // ✅ use streamClient (video) to generate token, not chatClient
        const token = streamClient.generateUserToken({ 
            user_id: req.user.clerkId 
        });

        res.status(200).json({
            token, 
            userId: req.user.clerkId,
            userName: req.user.name,
            userImage: req.user.profileImage, // ← also fix: was req.user.image, should be req.user.profileImage
        });
    } catch (error) {
        console.log("Error generating stream token:", error);
        res.status(500).json({ msg: "Failed to generate stream token" });
    }
}