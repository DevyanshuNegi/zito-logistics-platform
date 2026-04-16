import { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.id) {
      console.log('⚠️ Socket: No user ID, waiting for auth...');
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) {
      console.log('⚠️ Socket: No token found, skipping connection');
      return;
    }

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    console.log(`📡 Socket: Connecting as ${user.role} (${user.id})...`);

    const socketInstance = io(apiUrl, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling']
    });

    // Connection events
    socketInstance.on('connect', () => {
      console.log('✅ Socket connected:', socketInstance.id);
      setConnected(true);
      setError(null);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
      setConnected(false);
    });

    socketInstance.on('connect_error', (err) => {
      console.error('❌ Socket connection error:', err.message);
      setError(err.message);
    });

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      if (socketInstance.connected) {
        socketInstance.emit('ping', () => {});
      }
    }, 30000);

    setSocket(socketInstance);

    return () => {
      clearInterval(heartbeat);
      socketInstance.disconnect();
      console.log('🔌 Socket cleanup: disconnected');
    };
  }, [user?.id]);

  return (
    <SocketContext.Provider value={{ socket, connected, error }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context.socket;
};

export const useSocketStatus = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocketStatus must be used within SocketProvider');
  }
  return { connected: context.connected, error: context.error };
};
