import { useEffect, useRef, useState, useCallback } from 'react';

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface WebSocketMessage {
  type: string;
  data: unknown;
}

interface UseWebSocketOptions {
  url: string;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  reconnectAttempts?: number;
}

export function useWebSocket({
  url,
  onMessage,
  onConnect,
  onDisconnect,
  onError,
  autoReconnect = true,
  reconnectInterval = 5000,
  reconnectAttempts = 3,
}: UseWebSocketOptions) {
  const [status, setStatus] = useState<WebSocketStatus>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const shouldReconnectRef = useRef(true);

  // Store callbacks in refs to avoid recreating connect function
  const onMessageRef = useRef(onMessage);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  const onErrorRef = useRef(onError);

  // Update refs when callbacks change
  useEffect(() => {
    onMessageRef.current = onMessage;
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
    onErrorRef.current = onError;
  }, [onMessage, onConnect, onDisconnect, onError]);

  const connect = useCallback(() => {
    // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    // console.log('🔌 WebSocket Connect Function Called');
    // console.log('   URL:', url);
    // console.log('   Current Status:', status);
    // console.log('   Current ReadyState:', wsRef.current?.readyState);
    // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // console.log('⏭️  WebSocket already connected, skipping...');
      return;
    }

    // console.log('📡 Creating new WebSocket connection...');
    setStatus('connecting');

    try {
      const ws = new WebSocket(url);
      // console.log('✅ WebSocket object created successfully');
      // console.log('   ReadyState:', ws.readyState, '(0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)');

      ws.onopen = () => {
        // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        // console.log('✅ WebSocket CONNECTED!');
        // console.log('   URL:', url);
        // console.log('   ReadyState:', ws.readyState);
        // console.log('   Protocol:', ws.protocol);
        // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        setStatus('connected');
        reconnectAttemptsRef.current = 0;
        onConnectRef.current?.();
      };

      ws.onmessage = (event) => {
        // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        // console.log('📨 WebSocket MESSAGE RECEIVED');
        // console.log('   Raw Data:', event.data);
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          // console.log('   Parsed Type:', message.type);
          // console.log('   Parsed Data:', message.data);
          // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          onMessageRef.current?.(message);
        } catch (error) {
          console.error('❌ Failed to parse WebSocket message:', error);
          // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        }
      };

      ws.onerror = (error) => {
        // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        // console.error('❌ WebSocket ERROR');
        // console.error('   URL:', url);
        // console.error('   Error Object:', error);
        // console.error('   ReadyState:', ws.readyState);
        // console.error('   Type:', (error as Event).type);
        // console.error('   Target:', (error as Event).target);
        // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        setStatus('error');
        onErrorRef.current?.(error);
      };

      ws.onclose = (event) => {
        // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        // console.log('🔌 WebSocket CLOSED');
        // console.log('   Code:', event.code);
        // console.log('   Reason:', event.reason || 'No reason provided');
        // console.log('   Clean:', event.wasClean);
        // console.log('   Should Reconnect:', shouldReconnectRef.current);
        // console.log('   Auto Reconnect Enabled:', autoReconnect);
        // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        setStatus('disconnected');
        wsRef.current = null;
        onDisconnectRef.current?.();

        // Auto-reconnect logic
        if (autoReconnect && shouldReconnectRef.current) {
          if (reconnectAttemptsRef.current < reconnectAttempts) {
            reconnectAttemptsRef.current++;
            // console.log(`🔄 Scheduling reconnect attempt ${reconnectAttemptsRef.current}/${reconnectAttempts} in ${reconnectInterval}ms`);

            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, reconnectInterval);
          } else {
            // console.log('❌ Max reconnect attempts reached. Giving up.');
          }
        }
      };

      wsRef.current = ws;
      // console.log('✅ WebSocket stored in ref');
    } catch (error) {
      // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ EXCEPTION while creating WebSocket connection');
      console.error('   Error:', error);
      console.error('   Error Message:', (error as Error).message);
      // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      setStatus('error');
    }
  }, [url, autoReconnect, reconnectInterval, reconnectAttempts, status]);

  const disconnect = useCallback(() => {
    // console.log('Disconnecting WebSocket...');
    shouldReconnectRef.current = false;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setStatus('disconnected');
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      // console.log('📤 Sent WebSocket message:', message.type);
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    shouldReconnectRef.current = true;
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    status,
    sendMessage,
    disconnect,
    reconnect: connect,
  };
}
