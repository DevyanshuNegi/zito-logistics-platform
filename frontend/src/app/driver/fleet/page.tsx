'use client';

import { useEffect, useState } from 'react';
import { Gauge, ShieldCheck, Truck } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
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
  } | null;
};

function statusClassName(status?: string | null) {
  const normalized = status?.toUpperCase() ?? '';
  if (['ACTIVE', 'AVAILABLE', 'APPROVED'].includes(normalized)) {
    return 'bg-[#dcfce7] text-[#15803d]';
  }
  if (['PENDING', 'INACTIVE'].includes(normalized)) {
    return 'bg-[#fef3c7] text-[#92400e]';
  }
  if (['SUSPENDED', 'BLOCKED', 'RETIRED'].includes(normalized)) {
    return 'bg-[#fee2e2] text-[#b91c1c]';
  }
  return 'bg-[#eef4ff] text-[#1b3f72]';
}

export default function DriverFleetPage() {
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadFleet() {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<DriverProfile>('/drivers/me');
      setProfile(response);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load assigned vehicle.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFleet();
  }, []);

  if (loading) {
    return <Spinner />;
  }

  const vehicle = profile?.vehicle;

  return (
    <div className="space-y-4">
      {error ? (
        <Alert title="Fleet issue" variant="danger">
          {error}
        </Alert>
      ) : null}

      <section className="rounded-[22px] border border-[#d7e0ec] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
              Fleet
            </p>
            <h1 className="mt-1 text-base font-semibold text-[#1a1a2e]">
              Assigned vehicle details
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#64748b]">
              This is the vehicle currently linked to your driver profile for dispatch, trip matching, and compliance.
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eef4ff] text-[#1b3f72]">
            <Truck className="h-4.5 w-4.5" />
          </div>
        </div>
      </section>

      {vehicle ? (
        <>
          <section className="grid grid-cols-3 gap-3">
            {[
              {
                label: 'Plate',
                value: vehicle.plateNumber ?? 'Pending',
                icon: Truck,
              },
              {
                label: 'Type',
                value: vehicle.type ? formatStatus(vehicle.type) : 'Pending',
                icon: Gauge,
              },
              {
                label: 'Status',
                value: vehicle.status ? formatStatus(vehicle.status) : 'Pending',
                icon: ShieldCheck,
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

          <section className="rounded-[22px] border border-[#d7e0ec] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                  Vehicle card
                </p>
                <h2 className="mt-1 text-base font-semibold text-[#1a1a2e]">
                  {vehicle.make ?? 'Assigned'} {vehicle.model ?? 'vehicle'}
                </h2>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClassName(vehicle.status)}`}>
                {vehicle.status ? formatStatus(vehicle.status) : 'Pending'}
              </span>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="rounded-[16px] border border-[#edf2f8] bg-[#f8faff] px-3 py-3">
                <p className="text-sm font-semibold text-[#1a1a2e]">Payload capacity</p>
                <p className="mt-1 text-xs leading-5 text-[#64748b]">
                  {vehicle.capacityKg ? `${vehicle.capacityKg} kg available for dispatch planning.` : 'Capacity details are still being added to this fleet record.'}
                </p>
              </div>
              <div className="rounded-[16px] border border-[#edf2f8] bg-[#f8faff] px-3 py-3">
                <p className="text-sm font-semibold text-[#1a1a2e]">Driver fleet role</p>
                <p className="mt-1 text-xs leading-5 text-[#64748b]">
                  Drivers do not manage the full owner fleet from this mobile app. This screen gives the assigned-vehicle view needed for trips, readiness, and breakdown support.
                </p>
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className="rounded-[18px] border border-dashed border-[#d7e0ec] bg-white px-4 py-6 text-center shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
          <p className="text-sm font-semibold text-[#1a1a2e]">No assigned vehicle yet</p>
          <p className="mt-2 text-sm leading-6 text-[#64748b]">
            Your fleet card will appear here after operations or the partner owner links a vehicle to your driver profile.
          </p>
        </section>
      )}
    </div>
  );
}
