// routes/userRoutes.js
import express from "express";
import { protectRoute } from "../middleware/protectRoute.js";
import User from "../models/User.js";

const router = express.Router();

// Get current user's role
router.get("/role", protectRoute, async (req, res) => {
  try {
    // req.user is already attached from protectRoute middleware
    res.status(200).json({ 
      role: req.user.role || "user"
    });
  } catch (error) {
    console.error("Error getting user role:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;