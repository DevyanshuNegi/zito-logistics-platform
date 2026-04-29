'use client';

import { useEffect, useState } from 'react';

export type OfflineQueueItem<T> = {
  id: string;
  createdAt: string;
  payload: T;
  lastError?: string | null;
};

type UseOfflineSyncOptions<T> = {
  storageKey: string;
  syncItem: (payload: T) => Promise<unknown>;
  autoFlush?: boolean;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Sync failed';
}

function createQueueId() {
  return `queue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useOfflineSync<T>({
  storageKey,
  syncItem,
  autoFlush = true,
}: UseOfflineSyncOptions<T>) {
  const [queue, setQueue] = useState<OfflineQueueItem<T>[]>([]);
  const [isOnline, setIsOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as OfflineQueueItem<T>[];
      setQueue(Array.isArray(parsed) ? parsed : []);
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify(queue));
  }, [queue, storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  async function flushQueue() {
    if (syncing || !isOnline || queue.length === 0) {
      return { synced: 0, failed: queue.length };
    }

    setSyncing(true);
    const failedItems: OfflineQueueItem<T>[] = [];
    let synced = 0;

    for (const item of queue) {
      try {
        await syncItem(item.payload);
        synced += 1;
      } catch (error) {
        failedItems.push({
          ...item,
          lastError: getErrorMessage(error),
        });
      }
    }

    setQueue(failedItems);
    setSyncing(false);

    return {
      synced,
      failed: failedItems.length,
    };
  }

  useEffect(() => {
    if (!autoFlush || !isOnline || queue.length === 0) {
      return;
    }

    void flushQueue();
  }, [autoFlush, isOnline, queue.length]);

  function enqueue(payload: T) {
    const item: OfflineQueueItem<T> = {
      id: createQueueId(),
      createdAt: new Date().toISOString(),
      payload,
      lastError: null,
    };

    setQueue(current => [...current, item]);
    return item;
  }

  function clearQueue() {
    setQueue([]);
  }

  return {
    queue,
    isOnline,
    syncing,
    enqueue,
    flushQueue,
    clearQueue,
  };
}
