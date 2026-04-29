'use client';

import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getApiOrigin } from '@/lib/api';

type SocketOptions = {
  namespace?: string;
  enabled?: boolean;
};

export function useSocket(options: SocketOptions = {}) {
  const { namespace = '/tracking', enabled = true } = options;
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const client = io(`${getApiOrigin()}${namespace}`, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    client.on('connect', onConnect);
    client.on('disconnect', onDisconnect);
    setSocket(client);

    return () => {
      client.off('connect', onConnect);
      client.off('disconnect', onDisconnect);
      client.close();
      setSocket(null);
      setConnected(false);
    };
  }, [enabled, namespace]);

  return { socket, connected };
}
