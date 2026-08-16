// hooks/useWebSocket.js
import { useEffect, useRef, useState, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useUserRole } from './useUserRole';

export function useWebSocket(sessionId, onNotification) {
  const { user } = useUser();
  const { isHR } = useUserRole();
  const wsRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectAttemptRef = useRef(0);
  const pingIntervalRef = useRef(null);
  
  // Store the notification handler in a ref to avoid stale closures
  const notificationHandlerRef = useRef(onNotification);
  
  // Update the notification handler ref when onNotification changes
  useEffect(() => {
    notificationHandlerRef.current = onNotification;
    console.log('🔄 Updated notification handler ref', { hasHandler: !!onNotification });
  }, [onNotification]);

  // Stable connect function with useCallback and proper dependencies
  const connect = useCallback(() => {
    if (!sessionId || !user) {
      console.log('⏭️ Skipping WebSocket connection - missing sessionId or user');
      return;
    }

    const currentRole = isHR ? 'hr' : 'user';
    console.log('🔗 Connecting WebSocket as:', { 
      role: currentRole, 
      userId: user.id,
      sessionId,
      hasNotificationHandler: !!notificationHandlerRef.current 
    });

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const backendHost = import.meta.env.VITE_API_BASE_URL.replace(/^https?:\/\//, '');
    const wsUrl = `${protocol}//${backendHost}/ws?sessionId=${sessionId}&userId=${user.id}&role=${currentRole}`;

    console.log('🔗 Attempting WebSocket connection to:', wsUrl);

    try {
      // Close existing connection if any
      if (wsRef.current) {
        console.log('🔌 Closing previous WebSocket connection');
        wsRef.current.close(1000, 'Reconnecting');
      }

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`✅ WebSocket connected successfully as ${currentRole}`);
        setIsConnected(true);
        reconnectAttemptRef.current = 0;
        
        // Send HR subscription with delay to ensure connection is ready
        if (currentRole === 'hr') {
          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
              const subscribeMsg = JSON.stringify({ 
                type: 'hr_subscribe',
                sessionId,
                userId: user.id,
                userName: user.fullName || user.username,
                timestamp: Date.now()
              });
              ws.send(subscribeMsg);
              console.log('📤 Sent HR subscription message:', subscribeMsg);
            } else {
              console.warn('⚠️ WebSocket not open for HR subscription');
            }
          }, 500); // Wait 500ms after connection
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 WebSocket message received:', data);
          
          // Handle pong messages (heartbeat)
          if (data.type === 'pong') {
            console.log('❤️ Received pong heartbeat');
            return;
          }
          
          // Handle tab switch violations specifically
          if (data.type === 'tab_switch_violation') {
            console.log('🚨 Tab switch violation detected:', {
              forUser: data.userName || data.userId,
              count: data.violationCount || data.count,
              session: data.sessionId
            });
            
            // Call notification handler if available
            if (notificationHandlerRef.current) {
              try {
                notificationHandlerRef.current(data);
              } catch (error) {
                console.error('❌ Error in notification handler:', error);
              }
            } else {
              console.warn('⚠️ No notification handler registered');
            }
          } else if (data.type === 'hr_subscribed') {
            console.log('✅ Successfully subscribed as HR for session:', data.sessionId);
          } else if (data.type === 'error') {
            console.error('❌ WebSocket server error:', data.message);
          } else {
            // Forward any other messages to the notification handler
            if (notificationHandlerRef.current && data.type !== 'ping') {
              notificationHandlerRef.current(data);
            }
          }
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error, 'Raw data:', event.data);
        }
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
          role: currentRole,
          sessionId
        });
        
        setIsConnected(false);
        
        // Clear ping interval when disconnected
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        
        // Only reconnect on abnormal closure (not code 1000) and if we're not already reconnecting
        if (event.code !== 1000 && reconnectAttemptRef.current < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 10000);
          console.log(`⏳ Reconnecting in ${delay}ms (attempt ${reconnectAttemptRef.current + 1}/5)`);
          
          const reconnectTimeout = setTimeout(() => {
            reconnectAttemptRef.current++;
            connect();
          }, delay);
          
          // Store timeout reference to clear if component unmounts
          wsRef.current._reconnectTimeout = reconnectTimeout;
        } else if (reconnectAttemptRef.current >= 5) {
          console.log('❌ Max reconnection attempts reached');
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
      };

    } catch (error) {
      console.error('❌ Failed to create WebSocket:', error);
    }
  }, [sessionId, user, isHR]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      console.log('🔌 Manually disconnecting WebSocket');
      
      // Clear any pending reconnect timeout
      if (wsRef.current._reconnectTimeout) {
        clearTimeout(wsRef.current._reconnectTimeout);
      }
      
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
      setIsConnected(false);
      reconnectAttemptRef.current = 0;
      
      // Clear ping interval
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
    }
  }, []);

  // Send a ping to keep connection alive
  const sendPing = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ 
          type: 'ping',
          timestamp: Date.now()
        }));
      } catch (error) {
        console.error('❌ Failed to send ping:', error);
      }
    }
  }, []);

  // Setup ping interval when connected
  useEffect(() => {
    if (isConnected && !pingIntervalRef.current) {
      console.log('⏱️ Setting up ping interval');
      pingIntervalRef.current = setInterval(() => {
        sendPing();
      }, 25000); // Every 25 seconds (less than typical server timeout)
    }
    
    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
    };
  }, [isConnected, sendPing]);

  // Main connection effect - only run when sessionId, user.id, or isHR changes
  useEffect(() => {
    console.log('🔗 WebSocket main connection effect triggered:', {
      sessionId,
      userId: user?.id,
      isHR,
      timestamp: new Date().toISOString()
    });
    
    // Only connect if we have all required data
    if (sessionId && user?.id) {
      connect();
    }
    
    return () => {
      console.log('🔌 WebSocket cleanup on dependency change');
      disconnect();
    };
  }, [sessionId, user?.id, isHR, connect, disconnect]);

  // Send a notification
  const sendNotification = useCallback((notification) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        const message = JSON.stringify({
          ...notification,
          timestamp: Date.now(),
          userId: user?.id
        });
        wsRef.current.send(message);
        console.log('📤 Sent notification:', message);
        return true;
      } catch (error) {
        console.error('❌ Failed to send notification:', error);
        return false;
      }
    } else {
      console.warn('⚠️ Cannot send notification - WebSocket not connected');
      return false;
    }
  }, [user]);

  // Reconnect function
  const reconnect = useCallback(() => {
    console.log('🔄 Manually reconnecting WebSocket');
    disconnect();
    reconnectAttemptRef.current = 0;
    setTimeout(() => connect(), 100);
  }, [connect, disconnect]);

  // Get connection status
  const getConnectionStatus = useCallback(() => {
    if (!wsRef.current) return 'disconnected';
    
    switch (wsRef.current.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'connected';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'closed';
      default: return 'unknown';
    }
  }, []);

  return {
    isConnected,
    sendNotification,
    disconnect,
    reconnect,
    getConnectionStatus,
    connectionDetails: {
      sessionId,
      userId: user?.id,
      role: isHR ? 'hr' : 'user',
      readyState: wsRef.current?.readyState
    }
  };
}
