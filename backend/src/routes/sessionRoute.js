import express from "express"
import { protectRoute } from "../middleware/protectRoute.js";
import { 
  createSession, 
  endSession, 
  getActiveSessions, 
  getMyRecentSessions, 
  getSessionById, 
  joinSession,
  getSessionSecurityConfig,
  getAllSessions,
  joinSessionAsHR,
  grantTabSwitchPermission, // ADD THIS IMPORT
  logViolation,
  checkTabSwitchPermission,
  leaveSession 
} from "../controllers/sessionController.js";
import { requireHR } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Regular user routes
router.post("/", protectRoute, createSession);
router.get("/active", protectRoute, getActiveSessions);
router.get("/my-recent", protectRoute, getMyRecentSessions);
router.get("/:id/security", protectRoute, getSessionSecurityConfig);
router.get("/:id/tab-permission", protectRoute, checkTabSwitchPermission);
router.post("/:id/leave", protectRoute, leaveSession);

// HR specific routes
router.get("/admin/all-sessions", protectRoute, requireHR, getAllSessions);
router.post("/:id/hr-join", protectRoute, requireHR, joinSessionAsHR);
router.post("/:id/grant-permission", protectRoute, requireHR, grantTabSwitchPermission); // ADD THIS ROUTE

// Regular session routes
router.get("/:id", protectRoute, getSessionById);
router.post("/:id/join", protectRoute, joinSession);
router.post("/:id/end", protectRoute, endSession);
router.post("/:id/violation", protectRoute, logViolation);
export default router; 