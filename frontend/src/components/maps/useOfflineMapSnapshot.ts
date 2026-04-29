'use client';

import { useEffect, useState } from 'react';

type StoredSnapshot<T> = {
  cachedAt: string;
  data: T;
};

type UseOfflineMapSnapshotOptions<T> = {
  storageKey: string;
  liveData: T;
  hasLiveData: boolean;
};

export function useOfflineMapSnapshot<T>({
  storageKey,
  liveData,
  hasLiveData,
}: UseOfflineMapSnapshotOptions<T>) {
  const [cachedSnapshot, setCachedSnapshot] = useState<StoredSnapshot<T> | null>(null);
  const [isOnline, setIsOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as StoredSnapshot<T>;
      if (parsed && typeof parsed === 'object' && 'data' in parsed) {
        setCachedSnapshot(parsed);
      }
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || !hasLiveData) {
      return;
    }

    const snapshot: StoredSnapshot<T> = {
      cachedAt: new Date().toISOString(),
      data: liveData,
    };

    window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
    setCachedSnapshot(snapshot);
  }, [hasLiveData, liveData, storageKey]);

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

  const usingCache = !hasLiveData && cachedSnapshot != null;

  return {
    data: usingCache ? cachedSnapshot.data : liveData,
    cachedAt: usingCache ? cachedSnapshot.cachedAt : null,
    usingCache,
    isOnline,
  };
}
