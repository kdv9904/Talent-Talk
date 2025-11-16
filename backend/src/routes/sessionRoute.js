import express from "express"
import { protectRoute } from "../middleware/protectRoute.js";
import { createSession, endSession, getActiveSessions, getMyRecentSessions, getSessionById, joinSession } from "../controllers/sessionController.js";

const router = express.Router();

router.post("/", createSession);
router.get("/active", getActiveSessions);
router.get("/my-recent", getMyRecentSessions);

router.get("/:id", getSessionById);
router.post("/:id/join", joinSession);
router.get("/:id/end", endSession);
export default router; 