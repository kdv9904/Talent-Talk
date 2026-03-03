import express from "express";
import path from "path";
import cors from "cors";
import { serve } from "inngest/express";
import { clerkMiddleware } from "@clerk/express";
import http from "http";
import { WebSocketServer } from "ws";

import { ENV } from "./lib/env.js";
import { connectDB } from "./lib/db.js";
import { inngest, functions } from "./lib/inngest.js";
import { initializeWebSocketFunctions } from "./lib/websocket.js";

import chatRoutes from "./routes/chatRoutes.js";
import sessionRoutes from "./routes/sessionRoute.js";
import adminRoutes from "./routes/adminRoutes.js";
import userRoutes from "./routes/userRoutes.js";

const app = express();
const __dirname = path.resolve();

// Create HTTP server for WebSocket support
const server = http.createServer(app);

// WebSocket Server Setup
const wss = new WebSocketServer({ server, path: "/ws" });
const hrConnections = new Map(); // Map sessionId -> [HR connections]
const userConnections = new Map(); // Map userId -> connection

// WebSocket connection handler
wss.on("connection", (ws, request) => {
  console.log("🔗 New WebSocket connection");
  
  // Extract query parameters from URL
  const url = new URL(request.url, `http://${request.headers.host}`);
  const sessionId = url.searchParams.get("sessionId");
  const userId = url.searchParams.get("userId");
  const userRole = url.searchParams.get("role");

  console.log(`🔗 WebSocket details: user=${userId}, role=${userRole}, session=${sessionId}`);

  if (!sessionId || !userId || !userRole) {
    console.log("⚠️ WebSocket connection missing parameters, closing");
    ws.close(1008, "Missing parameters");
    return;
  }

  if (userRole === "hr" || userRole === "admin") {
    // HR connection for monitoring
    if (!hrConnections.has(sessionId)) {
      hrConnections.set(sessionId, []);
    }
    hrConnections.get(sessionId).push(ws);
    
    ws.on("close", () => {
      const connections = hrConnections.get(sessionId);
      if (connections) {
        const index = connections.indexOf(ws);
        if (index > -1) connections.splice(index, 1);
        if (connections.length === 0) hrConnections.delete(sessionId);
      }
      console.log(`🔌 HR WebSocket disconnected: ${userId} from session ${sessionId}`);
    });

    console.log(`👁️ HR ${userId} connected to monitor session ${sessionId}`);
    
    // Send welcome message
    ws.send(JSON.stringify({ 
      type: "welcome", 
      message: "Connected to HR monitoring system",
      sessionId,
      timestamp: new Date().toISOString()
    }));
  } else {
    // Regular user connection
    userConnections.set(userId, ws);
    
    ws.on("close", () => {
      userConnections.delete(userId);
      console.log(`🔌 User WebSocket disconnected: ${userId}`);
    });

    console.log(`👤 User ${userId} connected to session ${sessionId}`);
  }

  // Handle incoming messages
  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleWebSocketMessage(ws, message, sessionId, userId, userRole);
    } catch (error) {
      console.error("WebSocket message error:", error);
    }
  });

  // Heartbeat to keep connection alive
  const heartbeatInterval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
    }
  }, 30000);

  ws.on("close", () => {
    clearInterval(heartbeatInterval);
  });
});

function handleWebSocketMessage(ws, message, sessionId, userId, userRole) {
  switch (message.type) {
    case "ping":
      ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
      break;
    case "hr_subscribe":
      if (userRole === "hr" || userRole === "admin") {
        console.log(`👁️ HR ${userId} subscribed to session ${sessionId}`);
        ws.send(JSON.stringify({ 
          type: "subscribed", 
          sessionId,
          timestamp: new Date().toISOString()
        }));
      }
      break;
    default:
      console.log("Unknown WebSocket message:", message);
  }
}

// Function to notify HR about tab switch violations
function notifyHRTabSwitch(sessionId, userId, userName, violationCount, details) {
  const notification = {
    type: "tab_switch_violation",
    timestamp: new Date().toISOString(),
    sessionId,
    userId,
    userName,
    violationCount,
    details,
    severity: violationCount >= 2 ? "high" : "medium"
  };

  const connections = hrConnections.get(sessionId);
  if (connections) {
    let sentCount = 0;
    connections.forEach((ws) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(notification));
        sentCount++;
      }
    });
    console.log(`📢 Notified ${sentCount} HR monitor(s) about tab switch by ${userName} in session ${sessionId}`);
  } else {
    console.log(`📭 No HR monitors connected to session ${sessionId}`);
  }
}

// Function to get active HR monitors for a session
function getActiveHRMonitors(sessionId) {
  return hrConnections.get(sessionId)?.length || 0;
}

// Initialize WebSocket functions in the lib module
initializeWebSocketFunctions({
  notifyHRTabSwitch,
  getActiveHRMonitors
});

console.log('🔗 WebSocket functions initialized');

// Middleware
app.use(express.json());
app.use(cors({ origin: ENV.CLIENT_URL, credentials: true }));
app.use(clerkMiddleware());

// Routes
app.use("/api/inngest", serve({ client: inngest, functions }));
app.use("/api/chat", chatRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/user", userRoutes); 

app.get("/health", (req, res) => {
  res.status(200).json({ msg: "api is up and running" });
});

// WebSocket health endpoint
app.get("/api/ws-health", (req, res) => {
  const health = {
    status: "healthy",
    totalHRConnections: Array.from(hrConnections.values()).reduce((sum, arr) => sum + arr.length, 0),
    totalUserConnections: userConnections.size,
    monitoredSessions: Array.from(hrConnections.keys()),
    totalMonitoredSessions: hrConnections.size,
    timestamp: new Date().toISOString()
  };
  res.status(200).json(health);
});

// WebSocket info endpoint
app.get("/api/ws-info", (req, res) => {
  const sessionDetails = {};
  hrConnections.forEach((connections, sessionId) => {
    sessionDetails[sessionId] = {
      hrConnections: connections.length,
      hrUserIds: connections.map(ws => {
        // Extract user info from WebSocket if available
        return "HR User";
      })
    };
  });

  const info = {
    totalHRConnections: Array.from(hrConnections.values()).reduce((sum, arr) => sum + arr.length, 0),
    totalUserConnections: userConnections.size,
    monitoredSessions: Array.from(hrConnections.keys()),
    sessionDetails,
    timestamp: new Date().toISOString()
  };
  res.status(200).json(info);
});

const startServer = async () => {
  try {
    await connectDB();
    
    // Use server.listen instead of app.listen
    server.listen(ENV.PORT, () => {
      console.log(`🚀 Server is running on port: ${ENV.PORT}`);
      console.log(`🔗 WebSocket server available at ws://localhost:${ENV.PORT}/ws`);
      console.log(`👁️ HR Monitoring system is active`);
      console.log(`🌐 Health check: http://localhost:${ENV.PORT}/health`);
      console.log(`🔧 WebSocket health: http://localhost:${ENV.PORT}/api/ws-health`);
    });
  } catch (error) {
    console.error("💥 Error starting the server", error);
  }
};

startServer();