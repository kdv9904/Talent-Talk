import { chatClient, streamClient } from "../lib/stream.js";
import Session from "../models/Session.js";
import { canBypassTabRestrictions, canManageUsers } from "../middleware/roleMiddleware.js";

export async function createSession(req, res) {
    try {
        const { problem, difficulty, maxParticipants = 4 } = req.body;
        const userId = req.user._id;
        const clerkId = req.user.clerkId;

        if (!problem || !difficulty) {
            return res.status(400).json({ message: "Problem and difficulty are required" });
        }

        // Generate a unique call id for stream video
        const callId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        // Create session in db with empty participants array
        const session = await Session.create({ 
            problem, 
            difficulty, 
            host: userId, 
            callId, 
            maxParticipants,
            status: "active",
            participants: [] // Initialize empty participants array
        });

        // Create stream video call
        await streamClient.video.call("default", callId).getOrCreate({
            data: {
                created_by_id: clerkId,
                custom: { problem, difficulty, sessionId: session._id.toString(), maxParticipants },
            },
        });

        // Chat messaging
        const channel = chatClient.channel("messaging", callId, {
            name: `${problem} Session`,
            created_by_id: clerkId,
            members: [clerkId],
        });

        await channel.create();

        res.status(201).json({ session });
    } catch (error) {
        console.log("Error in createSession controller:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

export async function getActiveSessions(req, res) {
    try {
        const sessions = await Session.find({ status: "active" })
            .populate("host", "name profileImage email clerkId")
            .populate("participants.user", "name profileImage email clerkId")
            .sort({ createdAt: -1 })
            .limit(20);

        res.status(200).json({ sessions });
    } catch (error) {
        console.log("Error in getActiveSessions controller:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

export async function getMyRecentSessions(req, res) {
    try {
        const userId = req.user._id;

        // get sessions where user is either host or participant
        const sessions = await Session.find({
            status: "completed",
            $or: [
                { host: userId }, 
                { "participants.user": userId }
            ],
        })
            .populate("host", "name profileImage email clerkId")
            .populate("participants.user", "name profileImage email clerkId")
            .sort({ createdAt: -1 })
            .limit(20);

        res.status(200).json({ sessions });
    } catch (error) {
        console.log("Error in getMyRecentSessions controller:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

export async function getSessionById(req, res) {
    try {
        const { id } = req.params;

        const session = await Session.findById(id)
            .populate("host", "name email profileImage clerkId")
            .populate("participants.user", "name email profileImage clerkId");

        if (!session) return res.status(404).json({ message: "Session not found" });

        res.status(200).json({ session });
    } catch (error) {
        console.log("Error in getSessionById controller:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

export async function endSession(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const session = await Session.findById(id);

        if (!session) return res.status(404).json({ message: "Session not found" });

        // check if user is the host
        if (session.host.toString() !== userId.toString()) {
            return res.status(403).json({ message: "Only the host can end the session" });
        }

        // check if session is already completed
        if (session.status === "completed") {
            return res.status(400).json({ message: "Session is already completed" });
        }

        // delete stream video call
        const call = streamClient.video.call("default", session.callId);
        await call.delete({ hard: true });

        // delete stream chat channel
        const channel = chatClient.channel("messaging", session.callId);
        await channel.delete();

        session.status = "completed";
        await session.save();

        res.status(200).json({ session, message: "Session ended successfully" });
    } catch (error) {
        console.log("Error in endSession controller:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

// Add this function for HR to monitor sessions
export async function getAllSessions(req, res) {
    try {
        const user = req.user;
        
        // Only admin and HR can access all sessions
        if (!canManageUsers(user)) {
            return res.status(403).json({ message: "HR or Admin access required" });
        }

        const sessions = await Session.find()
            .populate("host", "name profileImage email clerkId role")
            .populate("participants.user", "name profileImage email clerkId role")
            .sort({ createdAt: -1 });

        res.status(200).json({ sessions });
    } catch (error) {
        console.log("Error in getAllSessions controller:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

// HR can join any session for monitoring
export async function joinSessionAsHR(req, res) {
    try {
        const { id } = req.params;
        const user = req.user;

        // Check if user is HR or Admin
        if (!canManageUsers(user)) {
            return res.status(403).json({ message: "HR or Admin access required" });
        }

        const session = await Session.findById(id);

        if (!session) {
            return res.status(404).json({ message: "Session not found" });
        }

        // HR joins as observer - don't set as participant
        const channel = chatClient.channel("messaging", session.callId);
        await channel.addMembers([user.clerkId]);

        await session.populate("host", "name profileImage email clerkId role")
                    .populate("participants.user", "name profileImage email clerkId role");

        res.status(200).json({ 
            session,
            joinedAs: "hr_observer",
            security: {
                allowTabSwitch: true, // HR can always switch tabs
                canMonitor: true
            }
        });
    } catch (error) {
        console.log("Error in joinSessionAsHR controller:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

// Update the existing security config function
export async function getSessionSecurityConfig(req, res) {
    try {
        const { id } = req.params;
        const user = req.user;

        const session = await Session.findById(id)
            .populate("host", "name email profileImage clerkId role")
            .populate("participants.user", "name email profileImage clerkId role");

        if (!session) {
            return res.status(404).json({ message: "Session not found" });
        }

        // Check if user is part of this session OR is HR/Admin
        const isHost = session.host._id.toString() === user._id.toString();
        const isParticipant = session.participants?.some(p => 
            p.user._id.toString() === user._id.toString()
        );
        const isHR = canManageUsers(user);

        if (!isHost && !isParticipant && !isHR) {
            return res.status(403).json({ message: "Not authorized for this session" });
        }

        // Security configuration - HR can always switch tabs
        const securityConfig = {
            allowTabSwitch: isHR || canBypassTabRestrictions(user),
            isHost,
            isHR,
            userRole: user.role,
            sessionStatus: session.status,
            canMonitor: isHR // HR can monitor without participating
        };

        res.status(200).json({ securityConfig });
    } catch (error) {
        console.log("Error in getSessionSecurityConfig:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

export async function joinSession(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        const clerkId = req.user.clerkId;
        const userRole = req.user.role;

        const session = await Session.findById(id);

        if (!session) return res.status(404).json({ message: "Session not found" });

        if (session.status !== "active") {
            return res.status(400).json({ message: "Cannot join a completed session" });
        }

        // Check if user is already a participant
        const isAlreadyParticipant = session.participants.some(p => p.user.toString() === userId.toString());
        if (isAlreadyParticipant) {
            return res.status(400).json({ message: "You are already in this session" });
        }

        // HR can join any session without counting towards participant limit
        if (userRole === "hr" || userRole === "admin") {
            const channel = chatClient.channel("messaging", session.callId);
            await channel.addMembers([clerkId]);
            
            await session.populate("host", "name profileImage email clerkId role");
            await session.populate("participants.user", "name profileImage email clerkId role");

            return res.status(200).json({ 
                session,
                joinedAs: "hr_observer",
                security: {
                    allowTabSwitch: true
                }
            });
        }

        // Check if session is full for regular users
        if (session.participants.length >= session.maxParticipants) {
            return res.status(409).json({ message: "Session is full" });
        }

        // Host cannot join as participant
        if (session.host.toString() === userId.toString()) {
            return res.status(400).json({ message: "Host cannot join their own session as participant" });
        }

        // Add user to participants array with tabSwitchAllowed undefined by default
        session.participants.push({
            user: userId,
            role: "coder",
            tabSwitchAllowed: undefined // Explicitly set as undefined
        });
        await session.save();

        const channel = chatClient.channel("messaging", session.callId);
        await channel.addMembers([clerkId]);
        
        await session.populate("host", "name profileImage email clerkId role");
        await session.populate("participants.user", "name profileImage email clerkId role");

        res.status(200).json({ 
            session,
            security: {
                allowTabSwitch: false // Regular users cannot switch tabs by default
            }
        });
    } catch (error) {
        console.log("Error in joinSession controller:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

// Enhanced grantTabSwitchPermission function with proper saving
export async function grantTabSwitchPermission(req, res) {
    try {
        const { id } = req.params;
        const { userId, permission } = req.body;
        const hrUser = req.user;

        // Check if user is HR or Admin
        if (!canManageUsers(hrUser)) {
            return res.status(403).json({ message: "HR or Admin access required" });
        }

        const session = await Session.findById(id);
        if (!session) {
            return res.status(404).json({ message: "Session not found" });
        }

        console.log('🔍 Before update - participants:', session.participants);

        // Find and update the participant
        const participantIndex = session.participants.findIndex(p => 
            p.user.toString() === userId
        );

        if (participantIndex === -1) {
            return res.status(404).json({ message: "Participant not found in session" });
        }

        // Update the permission - ensure it's a proper boolean
        const newPermission = permission === 'grant';
        session.participants[participantIndex].tabSwitchAllowed = newPermission;
        
        // Mark the participants array as modified to ensure save
        session.markModified('participants');
        
        // Save the session
        await session.save();

        // Verify the update by fetching the session again
        const updatedSession = await Session.findById(id);
        const updatedParticipant = updatedSession.participants.find(p => 
            p.user.toString() === userId
        );

        console.log('🔍 After update - tabSwitchAllowed:', updatedParticipant?.tabSwitchAllowed);
        console.log(`✅ HR ${hrUser._id} ${newPermission ? 'granted' : 'revoked'} tab switch permission for user ${userId} in session ${id}`);
        
        res.status(200).json({ 
            success: true, 
            message: `Tab switch permission ${newPermission ? 'granted' : 'revoked'} successfully`,
            permission: newPermission,
            grantedTo: userId,
            grantedBy: hrUser._id,
            sessionId: id,
            tabSwitchAllowed: updatedParticipant?.tabSwitchAllowed // Include for debugging
        });
    } catch (error) {
        console.log("Error in grantTabSwitchPermission:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

// Enhanced violation logging with session tracking
export async function logViolation(req, res) {
    try {
        const { id } = req.params;
        const { type, violations, details, count } = req.body;
        const userId = req.user._id;

        const session = await Session.findById(id);
        if (!session) {
            return res.status(404).json({ message: "Session not found" });
        }

        // Log violation details
        console.log('🚨 SECURITY VIOLATION:', {
            sessionId: id,
            userId: userId,
            type,
            violations,
            details,
            count,
            timestamp: new Date().toISOString(),
            sessionStatus: session.status,
            participantCount: session.participants ? session.participants.length + 1 : 1
        });

        // Update participant violation count if applicable
        const participantIndex = session.participants.findIndex(p => 
            p.user.toString() === userId.toString()
        );

        if (participantIndex !== -1) {
            if (!session.participants[participantIndex].violations) {
                session.participants[participantIndex].violations = [];
            }
            
            session.participants[participantIndex].violations.push({
                type,
                count,
                timestamp: new Date(),
                details
            });

            await session.save();
        }

        // Determine action based on violation count
        let action = 'warning_issued';
        if (count >= 3) {
            action = 'user_removed';
            // You might want to implement actual removal logic here
        }

        res.status(200).json({ 
            success: true, 
            message: 'Violation logged successfully',
            action,
            violationCount: count
        });
    } catch (error) {
        console.log("Error logging violation:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

// Updated checkTabSwitchPermission function with proper logic
export async function checkTabSwitchPermission(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    console.log('🔍 Checking tab switch permission for:', {
      sessionId: id,
      userId: userId,
      userRole: req.user.role
    });

    const session = await Session.findById(id)
      .populate("host", "name email profileImage clerkId role")
      .populate("participants.user", "name email profileImage clerkId role");

    if (!session) {
      console.log('❌ Session not found:', id);
      return res.status(404).json({ message: "Session not found" });
    }

    // Check if user is HR/Admin (they always have permission)
    if (canManageUsers(req.user)) {
      console.log('✅ User is HR/Admin - automatic permission');
      return res.status(200).json({ 
        hasPermission: true,
        reason: "HR/Admin role"
      });
    }

    // Check if user is host (hosts might have different rules)
    const isHost = session.host._id.toString() === userId.toString();
    if (isHost) {
      console.log('✅ User is host - automatic permission');
      return res.status(200).json({ 
        hasPermission: true,
        reason: "Session host"
      });
    }

    // Check if participant has been granted permission
    const participant = session.participants.find(p => 
      p.user && p.user._id.toString() === userId.toString()
    );

    // CORRECTED PERMISSION LOGIC
    let hasPermission = false;
    let reason = "Not granted";

    if (participant) {
      // If tabSwitchAllowed is EXPLICITLY TRUE, grant permission
      if (participant.tabSwitchAllowed === true) {
        hasPermission = true;
        reason = "Explicitly granted by HR";
      } 
      // If tabSwitchAllowed is UNDEFINED (never set by HR), NO permission by default
      else if (participant.tabSwitchAllowed === undefined) {
        hasPermission = false; // Default to NO permission
        reason = "Not granted by HR";
      }
      // If EXPLICITLY FALSE, definitely no permission
      else {
        hasPermission = false;
        reason = "Explicitly restricted by HR";
      }
    } else {
      // User is not even a participant
      hasPermission = false;
      reason = "Not a session participant";
    }

    console.log('🔍 Permission check result:', {
      userId,
      sessionId: id,
      isHost,
      isParticipant: !!participant,
      tabSwitchAllowed: participant?.tabSwitchAllowed,
      hasPermission,
      reason
    });

    res.status(200).json({ 
      hasPermission,
      reason,
      lastChecked: new Date().toISOString()
    });
  } catch (error) {
    console.log("Error in checkTabSwitchPermission:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

// Debug function to check session state
export async function debugSession(req, res) {
  try {
    const { id } = req.params;
    const session = await Session.findById(id)
      .populate("host", "name email profileImage clerkId role")
      .populate("participants.user", "name email profileImage clerkId role");
    
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    console.log('🔍 DEBUG Session Participants:', JSON.stringify(session.participants, null, 2));
    
    res.status(200).json({ 
      sessionId: id,
      participants: session.participants,
      participantCount: session.participants.length
    });
  } catch (error) {
    console.log("Debug error:", error.message);
    res.status(500).json({ message: "Debug failed" });
  }
} 