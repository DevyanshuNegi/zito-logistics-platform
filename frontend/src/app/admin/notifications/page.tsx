'use client';

import { useEffect, useState } from 'react';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { ApiError, api } from '@/lib/api';
import { compactId, formatDateTime, formatStatus } from '@/lib/format';

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  channel: string;
  status: string;
  entityType?: string | null;
  entityId?: string | null;
  createdAt: string;
  readAt?: string | null;
};

type NotificationsResponse = {
  notifications: NotificationItem[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
  pages: number;
};

export default function AdminNotificationsPage() {
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadNotifications() {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<NotificationsResponse>('/notifications?page=1&limit=50');
      setData(response);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadNotifications();
  }, []);

  async function markAsRead(notificationId: string) {
    setBusyId(notificationId);
    try {
      await api.patch(`/notifications/${notificationId}/read`);
      await loadNotifications();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to mark notification as read.');
    } finally {
      setBusyId(null);
    }
  }

  async function markAllAsRead() {
    setBusyId('all');
    try {
      await api.patch('/notifications/read-all');
      await loadNotifications();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to mark all notifications as read.');
    } finally {
      setBusyId(null);
    }
  }

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;
  const readCount = Math.max((data?.total ?? 0) - unreadCount, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Inbox total"
          value={String(data?.total ?? 0)}
          helper="Notification records visible in the current operator inbox."
          tone="info"
        />
        <StatCard
          label="Unread"
          value={String(unreadCount)}
          helper="Live items that still need operator acknowledgement."
          tone="warning"
        />
        <StatCard
          label="Read"
          value={String(readCount)}
          helper="Messages already acknowledged in this desk."
          tone="success"
        />
      </div>

      {error ? (
        <Alert title="Notification desk error" variant="danger">
          {error}
        </Alert>
      ) : null}

      <SurfaceCard
        title="Notifications desk"
        description="Operator inbox for alerts, workflow updates, OTP provider notices, and ticket/system events addressed to the current admin or super-admin account."
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => void loadNotifications()}>
              Refresh
            </Button>
            <Button
              disabled={busyId === 'all' || unreadCount === 0}
              onClick={() => void markAllAsRead()}
            >
              {busyId === 'all' ? 'Marking...' : 'Mark all read'}
            </Button>
          </div>
        }
      >
        <Alert title="Current API scope" variant="info">
          This desk shows the signed-in operator&apos;s own notifications. Global notification routing and broadcast controls can sit on top of this inbox later without changing the operator-side workflow.
        </Alert>

        <div className="mt-5">
          {loading ? (
            <div className="flex min-h-[20vh] items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <Table
              rows={notifications}
              emptyMessage="No notifications have been delivered to this operator yet."
              columns={[
                {
                  key: 'message',
                  header: 'Notification',
                  render: (notification) => (
                    <div>
                      <p className="font-semibold text-white">{notification.title}</p>
                      <p className="mt-1 text-sm text-slate-300">{notification.message}</p>
                    </div>
                  ),
                },
                {
                  key: 'context',
                  header: 'Context',
                  render: (notification) => (
                    <div className="text-xs text-slate-300">
                      <p>Channel: {formatStatus(notification.channel)}</p>
                      <p>Status: {formatStatus(notification.status)}</p>
                      <p>
                        Entity:{' '}
                        {notification.entityType
                          ? `${formatStatus(notification.entityType)} / ${compactId(notification.entityId)}`
                          : 'N/A'}
                      </p>
                    </div>
                  ),
                },
                {
                  key: 'time',
                  header: 'Delivered',
                  render: (notification) => (
                    <div className="text-xs text-slate-300">
                      <p>{formatDateTime(notification.createdAt)}</p>
                      <p className="mt-1">
                        {notification.readAt ? `Read ${formatDateTime(notification.readAt)}` : 'Unread'}
                      </p>
                    </div>
                  ),
                },
                {
                  key: 'actions',
                  header: 'Action',
                  render: (notification) =>
                    notification.readAt ? (
                      <span className="text-xs font-semibold text-emerald-300">Acknowledged</span>
                    ) : (
                      <Button
                        disabled={busyId === notification.id}
                        onClick={() => void markAsRead(notification.id)}
                      >
                        {busyId === notification.id ? 'Saving...' : 'Mark read'}
                      </Button>
                    ),
                },
              ]}
            />
          )}
        </div>
      </SurfaceCard>
    </div>
  );
}
