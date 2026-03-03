// lib/websocket.js

// WebSocket notification functions
let notifyHRTabSwitch = null;
let getActiveHRMonitors = null;

// Initialize WebSocket functions (call this from index.js)
export function initializeWebSocketFunctions(functions) {
  notifyHRTabSwitch = functions.notifyHRTabSwitch;
  getActiveHRMonitors = functions.getActiveHRMonitors;
  console.log('✅ WebSocket functions initialized in lib/websocket.js');
}

// Getter functions
export function getNotifyHRTabSwitch() {
  if (!notifyHRTabSwitch) {
    console.warn('⚠️ WebSocket functions not initialized yet. Call initializeWebSocketFunctions first.');
    // Return a dummy function that logs the call
    return function dummyNotify(sessionId, userId, userName, violationCount, details) {
      console.log(`[WebSocket not initialized] Would notify HR: ${userName} tab switched ${violationCount} times`);
      return null;
    };
  }
  return notifyHRTabSwitch;
}

export function getGetActiveHRMonitors() {
  if (!getActiveHRMonitors) {
    console.warn('⚠️ WebSocket functions not initialized yet');
    return () => 0;
  }
  return getActiveHRMonitors;
}

// Helper function to check if WebSocket is initialized
export function isWebSocketInitialized() {
  return notifyHRTabSwitch !== null;
}