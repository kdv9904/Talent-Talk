// middleware/protectRoute.js
import { requireAuth } from "@clerk/express";
import User from "../models/User.js";

export const protectRoute = [
  requireAuth(),
  async (req, res, next) => {
    try {
      const { userId: clerkId } = req.auth();

      if (!clerkId) {
        return res.status(401).json({ message: "Unauthorized - Invalid token" });
      }

      // Check user in DB - create if doesn't exist (for new signups)
      let user = await User.findOne({ clerkId });

      if (!user) {
        // Create new user with default role
        user = await User.create({
          clerkId,
          name: req.auth().session.user.fullName || "User",
          email: req.auth().session.user.primaryEmailAddress?.emailAddress || "",
          profileImage: req.auth().session.user.imageUrl || "",
          role: "user" // Default role
        });
      }

      req.user = user; // attach DB user with role
      next();
    } catch (error) {
      console.error("Error in protectRoute middleware:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
];