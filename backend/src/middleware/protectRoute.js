import { requireAuth } from "@clerk/express";
import User from "../models/User.js";

export const protectRoute = [
  requireAuth(),
  async (req, res, next) => {
    try {
      // NEW Clerk SDK → use req.auth()
      const { userId: clerkId } = req.auth();

      if (!clerkId) {
        return res.status(401).json({ message: "Unauthorized - Invalid token" });
      }

      // Check user in DB
      const user = await User.findOne({ clerkId });

      if (!user) {
        return res.status(404).json({ message: "User not found in database" });
      }

      req.user = user; // attach DB user
      next();
    } catch (error) {
      console.error("Error in protectRoute middleware:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
];
