// routes/adminRoutes.js
import express from "express";
import { protectRoute } from "../middleware/protectRoute.js";
import { requireAdmin, requireHR, canBypassTabRestrictions, canManageUsers } from "../middleware/roleMiddleware.js";
import User from "../models/User.js";
import Session from "../models/Session.js";

const router = express.Router();

// Get all users (ADMIN ONLY - not HR)
router.get("/users", protectRoute, requireAdmin, async (req, res) => {
  try {
    const users = await User.find().select("-__v").sort({ createdAt: -1 });
    res.status(200).json({ users });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Update user role (admin only - HR cannot change roles)
router.patch("/users/:userId/role", protectRoute, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    const validRoles = ["user", "admin", "hr"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true }
    ).select("-__v");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ 
      message: `Role updated to ${role}`,
      user 
    });
  } catch (error) {
    console.error("Error updating user role:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// HR-specific routes - get session analytics (HR and Admin can access)
router.get("/sessions/analytics", protectRoute, requireHR, async (req, res) => {
  try {
    const sessions = await Session.find()
      .populate("host", "name email role")
      .populate("participant", "name email role")
      .sort({ createdAt: -1 });

    const analytics = {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => s.status === "active").length,
      completedSessions: sessions.filter(s => s.status === "completed").length,
      recentSessions: sessions.slice(0, 10)
    };

    res.status(200).json({ analytics });
  } catch (error) {
    console.error("Error fetching session analytics:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Get current user's role info
router.get("/my-role", protectRoute, async (req, res) => {
  try {
    res.status(200).json({ 
      role: req.user.role,
      canBypassTabRestrictions: canBypassTabRestrictions(req.user),
      canManageUsers: canManageUsers(req.user),
      isHR: ["admin", "hr"].includes(req.user.role),
      isAdmin: req.user.role === "admin"
    });
  } catch (error) {
    console.error("Error getting user role:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;