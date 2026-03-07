import express from "express";
import path from "path";
import cors from "cors";
import { serve } from "inngest/express";
import { clerkMiddleware } from "@clerk/express";
import http from "http";
import { WebSocketServer } from "ws";
import { Webhook } from 'svix';

import { ENV } from "./lib/env.js";
import { connectDB } from "./lib/db.js";
import { inngest, functions } from "./lib/inngest.js";
import { initializeWebSocketFunctions } from "./lib/websocket.js";

import chatRoutes from "./routes/chatRoutes.js";
import sessionRoutes from "./routes/sessionRoute.js";
import adminRoutes from "./routes/adminRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import { protectRoute } from "./middleware/protectRoute.js";

const app = express();
app.post('/api/clerk-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  
  const svix_id        = req.headers['svix-id'];
  const svix_timestamp = req.headers['svix-timestamp'];
  const svix_signature = req.headers['svix-signature'];

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return res.status(400).json({ error: 'Missing svix headers' });
  }

  try {
    const wh = new Webhook(WEBHOOK_SECRET);
    const evt = wh.verify(req.body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    });

    await inngest.send({
      name: `clerk/${evt.type}`, 
      data: evt.data,
    });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Webhook verification failed:', err);
    res.status(400).json({ error: 'Invalid webhook signature' });
  }
});

const __dirname = path.resolve();

// Create HTTP server for WebSocket support
const server = http.createServer(app);

// WebSocket Server Setup
const wss = new WebSocketServer({ server, path: "/ws" });
const hrConnections = new Map();
const userConnections = new Map();

wss.on("connection", (ws, request) => {
  console.log("🔗 New WebSocket connection");
  
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
    
    ws.send(JSON.stringify({ 
      type: "welcome", 
      message: "Connected to HR monitoring system",
      sessionId,
      timestamp: new Date().toISOString()
    }));
  } else {
    userConnections.set(userId, ws);
    
    ws.on("close", () => {
      userConnections.delete(userId);
      console.log(`🔌 User WebSocket disconnected: ${userId}`);
    });

    console.log(`👤 User ${userId} connected to session ${sessionId}`);
  }

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleWebSocketMessage(ws, message, sessionId, userId, userRole);
    } catch (error) {
      console.error("WebSocket message error:", error);
    }
  });

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

function getActiveHRMonitors(sessionId) {
  return hrConnections.get(sessionId)?.length || 0;
}

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

// ─── Judge0 Language ID Map ───────────────────────────────────────────────────
const JUDGE0_LANGUAGE_IDS = {
  javascript: 93,  // Node.js 18.15.0
  python: 71,      // Python 3.11.2
  java: 62,        // Java 17
};

app.post('/api/execute', protectRoute, async (req, res) => {
  try {
    const { language, source_code } = req.body;

    const languageId = JUDGE0_LANGUAGE_IDS[language];
    if (!languageId) {
      return res.status(400).json({ error: `Unsupported language: ${language}` });
    }

    // Auto-wrap Java code with a runnable main class
    let finalCode = source_code;
    if (language === 'java' && !source_code.includes('public static void main')) {
      finalCode = `public class Main {
  public static void main(String[] args) {
    System.out.println("✅ Code compiled successfully! (No main method to run)");
  }
  ${source_code}
}`;
    }

    const submitResponse = await fetch('https://ce.judge0.com/submissions?base64_encoded=true&wait=true', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    language_id: languageId,
    source_code: Buffer.from(finalCode).toString('base64'),
    stdin: Buffer.from(req.body.stdin || '').toString('base64'),
  }),
});

    if (!submitResponse.ok) {
      const errText = await submitResponse.text();
      console.error('Judge0 error:', errText);
      return res.status(500).json({ error: 'Code execution failed', details: errText });
    }

    const result = await submitResponse.json();
    console.log('Judge0 response:', JSON.stringify(result));

    res.json({
  run: {
    output: result.stdout ? Buffer.from(result.stdout, 'base64').toString('utf-8') : '',
    stderr: result.stderr 
      ? Buffer.from(result.stderr, 'base64').toString('utf-8') 
      : result.compile_output 
        ? Buffer.from(result.compile_output, 'base64').toString('utf-8') 
        : '',
    code: result.exit_code ?? 0,
    signal: null,
  },
  language,
  version: req.body.version || '',
});

  } catch (err) {
    console.error('Execute route error:', err);
    res.status(500).json({ error: 'Code execution failed', details: err.message });
  }
});

app.get("/", (req, res) => {
  res.status(200).json({ msg: "Talent Talk API is running" });
});

app.get("/health", (req, res) => {
  res.status(200).json({ msg: "api is up and running" });
});

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

app.get("/api/ws-info", (req, res) => {
  const sessionDetails = {};
  hrConnections.forEach((connections, sessionId) => {
    sessionDetails[sessionId] = {
      hrConnections: connections.length,
      hrUserIds: connections.map(() => "HR User")
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