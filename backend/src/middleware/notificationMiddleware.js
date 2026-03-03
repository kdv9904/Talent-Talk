// middleware/notificationMiddleware.js
import { WebSocketServer } from 'ws';
import http from 'http';

const wss = new WebSocketServer({ noServer: true });
const hrConnections = new Map(); // Map sessionId -> [HR connections]
const userConnections = new Map(); // Map userId -> connection

export function setupWebSocket(server) {
  server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws, request) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const sessionId = url.searchParams.get('sessionId');
    const userId = url.searchParams.get('userId');
    const userRole = url.searchParams.get('role');

    console.log(`🔗 WebSocket connection: user=${userId}, role=${userRole}, session=${sessionId}`);

    if (userRole === 'hr' || userRole === 'admin') {
      // HR connection for monitoring
      if (!hrConnections.has(sessionId)) {
        hrConnections.set(sessionId, []);
      }
      hrConnections.get(sessionId).push(ws);
      
      ws.on('close', () => {
        const connections = hrConnections.get(sessionId);
        if (connections) {
          const index = connections.indexOf(ws);
          if (index > -1) connections.splice(index, 1);
          if (connections.length === 0) hrConnections.delete(sessionId);
        }
      });
    } else {
      // Regular user connection
      userConnections.set(userId, ws);
      
      ws.on('close', () => {
        userConnections.delete(userId);
      });
    }

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        handleWebSocketMessage(ws, message, sessionId, userId, userRole);
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });
  });
}

function handleWebSocketMessage(ws, message, sessionId, userId, userRole) {
  switch (message.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      break;
    case 'hr_subscribe':
      // HR subscribing to session notifications
      if (userRole === 'hr' || userRole === 'admin') {
        console.log(`👁️ HR ${userId} subscribed to session ${sessionId}`);
      }
      break;
    default:
      console.log('Unknown WebSocket message:', message);
  }
}

// Function to notify HR about tab switch violations
export function notifyHRTabSwitch(sessionId, userId, userName, violationCount, details) {
  const notification = {
    type: 'tab_switch_violation',
    timestamp: new Date().toISOString(),
    sessionId,
    userId,
    userName,
    violationCount,
    details,
    severity: violationCount >= 2 ? 'high' : 'medium'
  };

  const connections = hrConnections.get(sessionId);
  if (connections) {
    connections.forEach((ws) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(notification));
      }
    });
    console.log(`📢 Notified ${connections.length} HR(s) about tab switch by ${userName}`);
  }
}

// Function to get active HR monitors for a session
export function getActiveHRMonitors(sessionId) {
  return hrConnections.get(sessionId)?.length || 0;
}

export { wss };