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

      const user = await User.findOneAndUpdate(
        { clerkId },
        { $setOnInsert: { clerkId, name: "User", email: "", role: "user" } },
        { upsert: true, new: true }
      );

      req.user = user;
      next();
    } catch (error) {
      console.error("Error in protectRoute middleware:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
];