'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, ChevronRight, Clock3, MapPinned, ShieldCheck, Truck } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ApiError, api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

type DriverProfile = {
  user?: {
    fullName?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  vehicle?: {
    plateNumber?: string | null;
    type?: string | null;
    status?: string | null;
  } | null;
  isOnline?: boolean;
};

type ShiftStatus = {
  active: boolean;
  shift?: {
    id: string;
    shiftStartTime?: string;
  } | null;
  hoursElapsed?: number;
  hoursRemaining?: number;
  fatigueAlert?: string | null;
};

type ShiftHistory = {
  shifts: Array<{
    id: string;
    shiftStartTime?: string;
    shiftEndTime?: string | null;
    totalHours?: number | null;
    status?: string | null;
  }>;
};

type LocationState = {
  permission: 'checking' | 'granted' | 'denied' | 'prompt' | 'unsupported';
  syncing: boolean;
  message: string;
  lastSyncedAt?: string | null;
};

function getUserInitials(value?: string | null) {
  if (!value) {
    return 'ZT';
  }

  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return 'ZT';
  }

  return parts.map((part) => part.charAt(0).toUpperCase()).join('');
}

function getShiftStatusClasses(status?: string | null) {
  const normalized = status?.toUpperCase();
  if (normalized === 'ACTIVE') {
    return 'bg-[#dcfce7] text-[#15803d]';
  }
  if (normalized === 'ENDED' || normalized === 'COMPLETED') {
    return 'bg-[#dbeafe] text-[#1d4ed8]';
  }
  return 'bg-[#fef3c7] text-[#92400e]';
}

export default function DriverShiftPage() {
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [status, setStatus] = useState<ShiftStatus | null>(null);
  const [history, setHistory] = useState<ShiftHistory['shifts']>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationState, setLocationState] = useState<LocationState>({
    permission: 'checking',
    syncing: false,
    message: 'Checking live location access...',
    lastSyncedAt: null,
  });

  async function loadShiftData() {
    setLoading(true);
    setError(null);

    try {
      const [profileResponse, statusResponse, historyResponse] = await Promise.all([
        api.get<DriverProfile>('/drivers/me'),
        api.get<ShiftStatus>('/drivers/shift/status'),
        api.get<ShiftHistory>('/drivers/shift/history'),
      ]);

      setProfile(profileResponse);
      setStatus(statusResponse);
      setHistory(historyResponse.shifts);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load driver profile.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadShiftData();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function inspectPermission() {
      if (typeof window === 'undefined' || !('geolocation' in navigator)) {
        if (!cancelled) {
          setLocationState({
            permission: 'unsupported',
            syncing: false,
            message: 'Live location is not supported on this device or browser.',
            lastSyncedAt: null,
          });
        }
        return;
      }

      try {
        if (!('permissions' in navigator) || !navigator.permissions?.query) {
          if (!cancelled) {
            setLocationState({
              permission: 'prompt',
              syncing: false,
              message: 'Allow live location so dispatch and demand heatmap can place you accurately.',
              lastSyncedAt: null,
            });
          }
          return;
        }

        const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        if (cancelled) {
          return;
        }

        const nextPermission =
          result.state === 'granted'
            ? 'granted'
            : result.state === 'denied'
              ? 'denied'
              : 'prompt';

        setLocationState((current) => ({
          ...current,
          permission: nextPermission,
          syncing: false,
          message:
            nextPermission === 'granted'
              ? current.lastSyncedAt
                ? `Live location is enabled. Last sync ${formatDateTime(current.lastSyncedAt)}.`
                : 'Live location is enabled and ready to sync.'
              : nextPermission === 'denied'
                ? 'Location access is blocked. Re-enable it in browser or device settings for driver tracking.'
                : 'Allow live location so dispatch and demand heatmap can place you accurately.',
        }));

        result.onchange = () => {
          if (cancelled) {
            return;
          }
          const updatedPermission =
            result.state === 'granted'
              ? 'granted'
              : result.state === 'denied'
                ? 'denied'
                : 'prompt';
          setLocationState((current) => ({
            ...current,
            permission: updatedPermission,
            message:
              updatedPermission === 'granted'
                ? current.lastSyncedAt
                  ? `Live location is enabled. Last sync ${formatDateTime(current.lastSyncedAt)}.`
                  : 'Live location is enabled and ready to sync.'
                : updatedPermission === 'denied'
                  ? 'Location access is blocked. Re-enable it in browser or device settings for driver tracking.'
                  : 'Allow live location so dispatch and demand heatmap can place you accurately.',
          }));
        };
      } catch {
        if (!cancelled) {
          setLocationState({
            permission: 'prompt',
            syncing: false,
            message: 'Allow live location so dispatch and demand heatmap can place you accurately.',
            lastSyncedAt: null,
          });
        }
      }
    }

    void inspectPermission();

    return () => {
      cancelled = true;
    };
  }, []);

  async function runShiftAction(path: '/drivers/shift/start' | '/drivers/shift/end') {
    setBusy(true);
    setError(null);

    try {
      await api.post(path, {});
      await loadShiftData();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to update shift.');
    } finally {
      setBusy(false);
    }
  }

  async function syncDriverLocation() {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setLocationState({
        permission: 'unsupported',
        syncing: false,
        message: 'Live location is not supported on this device or browser.',
        lastSyncedAt: null,
      });
      return;
    }

    setLocationState((current) => ({
      ...current,
      syncing: true,
      message: 'Requesting current location...',
    }));

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await api.put('/drivers/me/location', {
            currentLatitude: position.coords.latitude,
            currentLongitude: position.coords.longitude,
          });
          const syncedAt = new Date().toISOString();
          setLocationState({
            permission: 'granted',
            syncing: false,
            message: `Live location enabled. Last sync ${formatDateTime(syncedAt)}.`,
            lastSyncedAt: syncedAt,
          });
        } catch (caught) {
          setLocationState((current) => ({
            ...current,
            permission: 'granted',
            syncing: false,
            message:
              caught instanceof ApiError
                ? caught.message
                : 'Location permission was granted, but the sync failed.',
          }));
        }
      },
      (locationError) => {
        const denied = locationError.code === locationError.PERMISSION_DENIED;
        setLocationState((current) => ({
          ...current,
          permission: denied ? 'denied' : current.permission === 'checking' ? 'prompt' : current.permission,
          syncing: false,
          message:
            denied
              ? 'Location access is blocked. Re-enable it in browser or device settings for driver tracking.'
              : 'Unable to fetch your current location. Try again from an open network area.',
        }));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  }

  if (loading) {
    return <Spinner />;
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Alert title="Driver profile issue" variant="danger">
          {error}
        </Alert>
      ) : null}

      {status?.fatigueAlert ? (
        <Alert title="Fatigue alert" variant="warning">
          {status.fatigueAlert}
        </Alert>
      ) : null}

      <section className="rounded-[22px] border border-[#d7e0ec] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1b3f72] text-lg font-bold text-white">
            {getUserInitials(profile?.user?.fullName ?? profile?.user?.email ?? profile?.user?.phone)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
              Driver profile
            </p>
            <h1 className="mt-1 truncate text-base font-semibold text-[#1a1a2e]">
              {profile?.user?.fullName ?? 'Driver account'}
            </h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-[#eef4ff] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#1b3f72]">
                {profile?.vehicle?.plateNumber ?? 'Vehicle pending'}
              </span>
              <span className="rounded-full bg-[#f8faff] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748b]">
                {profile?.isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-3">
        {[
          {
            label: 'Shift',
            value: status?.active ? 'Active' : 'Ended',
            icon: Clock3,
          },
          {
            label: 'Hours',
            value: `${status?.hoursElapsed ?? 0}h`,
            icon: BadgeCheck,
          },
          {
            label: 'Vehicle',
            value: profile?.vehicle?.type ?? 'Pending',
            icon: Truck,
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="rounded-[18px] border border-[#d7e0ec] bg-white px-3 py-4 text-center shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
            >
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#eef4ff] text-[#1b3f72]">
                <Icon className="h-4.5 w-4.5" />
              </div>
              <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">
                {item.label}
              </p>
              <p className="mt-1 text-sm font-semibold text-[#1a1a2e]">{item.value}</p>
            </div>
          );
        })}
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <Link
          href="/driver/fleet"
          className="rounded-[22px] border border-[#d7e0ec] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)] transition hover:border-[#b8c9e4] hover:bg-[#f8faff]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                Fleet
              </p>
              <h2 className="mt-1 text-base font-semibold text-[#1a1a2e]">
                Assigned vehicle and readiness
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#64748b]">
                Open your fleet view to see the assigned vehicle, capacity, and field-readiness state.
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eef4ff] text-[#1b3f72]">
              <ChevronRight className="h-4.5 w-4.5" />
            </div>
          </div>
        </Link>

        <section className="rounded-[22px] border border-[#d7e0ec] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                Location access
              </p>
              <h2 className="mt-1 text-base font-semibold text-[#1a1a2e]">
                Allow dispatch to place you correctly
              </h2>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eef4ff] text-[#1b3f72]">
              <MapPinned className="h-4.5 w-4.5" />
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${
                locationState.permission === 'granted'
                  ? 'bg-[#dcfce7] text-[#15803d]'
                  : locationState.permission === 'denied'
                    ? 'bg-[#fee2e2] text-[#b91c1c]'
                    : 'bg-[#fef3c7] text-[#92400e]'
              }`}
            >
              {locationState.permission}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#64748b]">{locationState.message}</p>

          <div className="mt-4">
            <Button
              onClick={() => void syncDriverLocation()}
              disabled={locationState.syncing}
              className="w-full rounded-[14px] shadow-none"
            >
              {locationState.permission === 'granted' ? 'Refresh live location' : 'Enable live location'}
            </Button>
          </div>
        </section>
      </section>

      <section className="rounded-[22px] border border-[#d7e0ec] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
              Shift controls
            </p>
            <h2 className="mt-1 text-base font-semibold text-[#1a1a2e]">
              Keep your account ready for the next load
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#64748b]">
              Start the shift before accepting jobs and end it cleanly when you are done for the day.
            </p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${getShiftStatusClasses(status?.active ? 'ACTIVE' : 'ENDED')}`}>
            {status?.active ? 'Active' : 'Ended'}
          </span>
        </div>

        <div className="mt-4 flex gap-2">
          <Button
            disabled={busy || !!status?.active}
            onClick={() => void runShiftAction('/drivers/shift/start')}
            className="flex-1 rounded-[14px] shadow-none"
          >
            Start shift
          </Button>
          <Button
            disabled={busy || !status?.active}
            onClick={() => void runShiftAction('/drivers/shift/end')}
            variant="secondary"
            className="flex-1 rounded-[14px] shadow-none"
          >
            End shift
          </Button>
        </div>
      </section>

      <section className="rounded-[22px] border border-[#d7e0ec] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
              Compliance
            </p>
            <h2 className="mt-1 text-base font-semibold text-[#1a1a2e]">
              Vehicle and account readiness
            </h2>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eef4ff] text-[#1b3f72]">
            <ShieldCheck className="h-4.5 w-4.5" />
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          <div className="rounded-[16px] border border-[#edf2f8] bg-[#f8faff] px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#1a1a2e]">Vehicle status</p>
              <span className="rounded-full bg-[#eef4ff] px-2.5 py-1 text-[10px] font-bold text-[#1b3f72]">
                {profile?.vehicle?.status ?? 'Pending'}
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-[#64748b]">
              {profile?.vehicle?.type
                ? `${profile.vehicle.type} ready for assignment under ${profile.vehicle.plateNumber ?? 'your current plate'}.`
                : 'Your vehicle details will appear here after fleet assignment is completed.'}
            </p>
          </div>
          <div className="rounded-[16px] border border-[#edf2f8] bg-[#f8faff] px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#1a1a2e]">Remaining hours</p>
              <span className="rounded-full bg-[#fef3c7] px-2.5 py-1 text-[10px] font-bold text-[#92400e]">
                {status?.hoursRemaining ?? 0}h
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-[#64748b]">
              The current fatigue guard allows up to 12 hours per shift before ops review is required.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[22px] border border-[#d7e0ec] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
            Shift history
          </p>
          <h2 className="mt-1 text-base font-semibold text-[#1a1a2e]">
            Recent sessions
          </h2>
        </div>

        <div className="mt-4 space-y-3">
          {history.length > 0 ? (
            history.slice(0, 5).map((shiftItem) => (
              <div
                key={shiftItem.id}
                className="rounded-[16px] border border-[#edf2f8] bg-[#f8faff] px-3 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#1a1a2e]">
                    {formatDateTime(shiftItem.shiftStartTime)}
                  </p>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${getShiftStatusClasses(shiftItem.status)}`}>
                    {shiftItem.status ?? 'Recorded'}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-[#64748b]">
                  Ended {formatDateTime(shiftItem.shiftEndTime)} / Total {shiftItem.totalHours ?? 0}h
                </p>
              </div>
            ))
          ) : (
            <div className="rounded-[18px] border border-dashed border-[#d7e0ec] bg-[#f8faff] px-4 py-5 text-center">
              <p className="text-sm font-semibold text-[#1a1a2e]">No shift history yet</p>
              <p className="mt-2 text-sm leading-6 text-[#64748b]">
                Your completed shift sessions will appear here after the first duty cycle is recorded.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
