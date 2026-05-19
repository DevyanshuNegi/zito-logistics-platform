'use client';

import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { StatCard } from '@/components/layout/StatCard';
import { OwnedFleetWorkspace } from '@/components/operations/OwnedFleetWorkspace';
import { FleetDriverManager } from '@/components/operations/FleetDriverManager';
import { ApiError, api } from '@/lib/api';
import { formatStatus } from '@/lib/format';

type DriverProfile = {
  vehicle?: {
    id?: string | null;
    plateNumber?: string | null;
    make?: string | null;
    model?: string | null;
    type?: string | null;
    capacityKg?: number | null;
    status?: string | null;
    verificationStatus?: string | null;
  } | null;
};

const EMPTY_VEHICLES: never[] = [];

export default function DriverFleetPage() {
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadProfile() {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<DriverProfile>('/drivers/me');
      setProfile(response);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to load the driver fleet workspace.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProfile();
  }, [refreshToken]);

  const assignedVehicle = profile?.vehicle;

  return (
    <div className="space-y-4">
      {error ? (
        <Alert title="Fleet issue" variant="danger">
          {error}
        </Alert>
      ) : null}

      <div className="grid gap-3">
        <StatCard
          label="Driver role"
          value="Fleet owner enabled"
          helper="Drivers can own vehicles in Zito, but every vehicle stays pending until admin approval and GPS activation."
          tone="info"
          surfaceTone="light"
        />
        <StatCard
          label="Assigned vehicle"
          value={assignedVehicle?.plateNumber ?? 'Pending'}
          helper={
            assignedVehicle
              ? `${formatStatus(assignedVehicle.type ?? 'VEHICLE')} · ${formatStatus(
                  assignedVehicle.status ?? 'PENDING_REVIEW',
                )}`
              : 'Your assigned dispatch vehicle appears here after operations or fleet assignment.'
          }
          tone="success"
          surfaceTone="light"
        />
      </div>

      <Alert title="Driver fleet rule" variant="info">
        Drivers still register and sign in through the Zito Partners driver app. If a driver owns vehicles, those vehicles use the same structured profile, camera-capture verification packet, admin approval, and GPS activation workflow as every other fleet owner.
      </Alert>

      {loading ? (
        <Spinner />
      ) : assignedVehicle ? (
        <section className="rounded-[22px] border border-[#d7e0ec] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
            Assigned vehicle
          </p>
          <h1 className="mt-1 text-base font-semibold text-[#1a1a2e]">
            {assignedVehicle.plateNumber}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#64748b]">
            This vehicle is currently linked to your driver profile for dispatch,
            trip matching, and live operations.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-[16px] border border-[#edf2f8] bg-[#f8faff] px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">
                Vehicle
              </p>
              <p className="mt-1 text-sm font-semibold text-[#1a1a2e]">
                {[assignedVehicle.make, assignedVehicle.model].filter(Boolean).join(' ') ||
                  'Assigned vehicle'}
              </p>
            </div>
            <div className="rounded-[16px] border border-[#edf2f8] bg-[#f8faff] px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">
                Status
              </p>
              <p className="mt-1 text-sm font-semibold text-[#1a1a2e]">
                {formatStatus(assignedVehicle.status ?? 'PENDING_REVIEW')}
              </p>
            </div>
            <div className="rounded-[16px] border border-[#edf2f8] bg-[#f8faff] px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">
                Verification
              </p>
              <p className="mt-1 text-sm font-semibold text-[#1a1a2e]">
                {formatStatus(assignedVehicle.verificationStatus ?? 'PENDING_REVIEW')}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <OwnedFleetWorkspace
        title="Driver-owned vehicles"
        description="Register self-owned or driver-controlled vehicles here. Every unit remains pending until the full structured profile, fresh camera-capture inspection packet, internal approval, and GPS setup are complete."
        platformFeeCopy="Driver-owned fleet records still flow into internal billing, finance, and compliance controls automatically where applicable."
        emptyMessage="No driver-owned vehicles exist yet."
        tone="light"
        refreshToken={refreshToken}
        onChange={() => {
          setRefreshToken((current) => current + 1);
        }}
      />

      <FleetDriverManager
        title="Linked driver roster"
        description="If this driver account operates a small driver-owned fleet, link other already-registered driver accounts here and assign them only after vehicle approval."
        ownerLabel="driver-owned fleet"
        vehicles={EMPTY_VEHICLES}
        tone="light"
        refreshToken={refreshToken}
        onChange={() => {
          setRefreshToken((current) => current + 1);
        }}
      />
    </div>
  );
}
