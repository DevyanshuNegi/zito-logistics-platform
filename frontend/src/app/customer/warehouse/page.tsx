'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, MapPinned, PackageCheck, Refrigerator, ShieldCheck, Snowflake, Warehouse } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { ApiError, api } from '@/lib/api';

type WarehouseRecord = {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: string | null;
  zones?: Array<{
    id: string;
    name: string;
    code: string;
    type?: string | null;
    capacity?: number | null;
  }>;
  _count?: {
    items?: number;
  };
};

const storageModes = [
  {
    value: 'DRY',
    label: 'Ambient / Dry',
    description: 'Standard storage for FMCG, electronics, and general cargo.',
    icon: Warehouse,
  },
  {
    value: 'COLD',
    label: 'Cold Store',
    description: '2-8 C storage for dairy, pharma, and chilled goods.',
    icon: Refrigerator,
  },
  {
    value: 'FROZEN',
    label: 'Frozen Store',
    description: 'Deep-freeze storage for frozen food and sensitive cargo.',
    icon: Snowflake,
  },
  {
    value: 'CROSS_DOCK',
    label: 'Cross-dock',
    description: 'Fast inbound-to-outbound flow without long storage stays.',
    icon: PackageCheck,
  },
] as const;

function matchesStorageMode(warehouse: WarehouseRecord, mode: string) {
  if (mode === 'ALL') {
    return true;
  }

  return warehouse.zones?.some((zone) => {
    const normalized = String(zone.type ?? '').toUpperCase();
    if (mode === 'DRY') {
      return normalized === 'DRY' || normalized === 'AMBIENT';
    }
    if (mode === 'COLD') {
      return normalized.includes('COLD');
    }
    if (mode === 'FROZEN') {
      return normalized.includes('FROZEN');
    }
    if (mode === 'CROSS_DOCK') {
      return normalized.includes('CROSS');
    }
    return false;
  });
}

export default function CustomerWarehousePage() {
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storageType, setStorageType] = useState<'ALL' | (typeof storageModes)[number]['value']>('ALL');
  const [locationFilter, setLocationFilter] = useState('');
  const [goodsDescription, setGoodsDescription] = useState('');
  const [expectedDuration, setExpectedDuration] = useState('');
  const [weight, setWeight] = useState('');
  const [appointmentWindow, setAppointmentWindow] = useState('');

  useEffect(() => {
    async function loadWarehouses() {
      setLoading(true);
      setError(null);

      try {
        const response = await api.get<WarehouseRecord[]>('/warehouse');
        setWarehouses(response);
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Unable to load warehouse options.');
      } finally {
        setLoading(false);
      }
    }

    void loadWarehouses();
  }, []);

  const filteredWarehouses = useMemo(() => {
    return warehouses.filter((warehouse) => {
      const searchBlob = `${warehouse.name} ${warehouse.code} ${warehouse.address ?? ''}`.toLowerCase();
      const matchesLocation = !locationFilter.trim() || searchBlob.includes(locationFilter.trim().toLowerCase());
      const matchesMode = matchesStorageMode(warehouse, storageType);
      return matchesLocation && matchesMode;
    });
  }, [locationFilter, storageType, warehouses]);

  return (
    <div className="space-y-3.5">
      {error ? (
        <Alert title="Warehouse options issue" variant="danger">
          {error}
        </Alert>
      ) : null}

      <section className="overflow-hidden rounded-[24px] border border-[#d7e0ec] bg-[linear-gradient(135deg,#06101f_0%,#0f1b31_100%)] p-4 text-white shadow-[0_12px_30px_rgba(6,16,31,0.22)]">
        <div className="space-y-3.5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/72">
              Warehouse booking
            </p>
            <h1 className="mt-1 text-[1.62rem] font-bold leading-[1.15]">Choose storage the modern way</h1>
            <p className="mt-2.5 text-[13px] leading-6 text-slate-300">
              Storage should not open the transport booking flow. Start by selecting the storage mode,
              inbound timing, and goods profile, then review eligible warehouses and capacity options.
            </p>
          </div>

          <div className="rounded-[18px] bg-white/8 px-4 py-3.5 shadow-[0_10px_30px_rgba(15,23,42,0.16)] backdrop-blur">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/72">
              Customer promise
            </p>
            <p className="mt-2 text-base font-extrabold">Warehouse-first flow</p>
            <p className="mt-2 text-[13px] leading-6 text-slate-300">
              Storage procedure is visible here. Final commercial review still stays with Zito operations.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[22px] border border-[#d7e0ec] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <div className="mb-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
            Storage options
          </p>
          <h2 className="mt-1 text-[1.05rem] font-semibold leading-6 text-[#1a1a2e]">
            Select the warehouse service you need
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {storageModes.map((mode) => {
            const Icon = mode.icon;
            const active = storageType === mode.value;

            return (
              <button
                key={mode.value}
                type="button"
                onClick={() => setStorageType(mode.value)}
                className={[
                  'rounded-[20px] border p-4 text-left transition',
                  active
                    ? 'border-transparent bg-gradient-to-br from-cyan-500/14 via-blue-500/12 to-violet-500/12 shadow-[0_10px_24px_rgba(59,130,246,0.14)]'
                    : 'border-[#d7e0ec] bg-white hover:border-[#93c5fd] hover:bg-[#f8fbff]',
                ].join(' ')}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#eef4ff] text-[#1b3f72]">
                  <Icon className="h-[18px] w-[18px]" />
                </div>
                <p className="mt-3 text-[15px] font-semibold leading-6 text-[#1a1a2e]">{mode.label}</p>
                <p className="mt-1 text-[13px] leading-6 text-[#64748b]">{mode.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-[22px] border border-[#d7e0ec] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <div className="mb-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
            Request details
          </p>
          <h2 className="mt-1 text-[1.05rem] font-semibold leading-6 text-[#1a1a2e]">
            Prepare the warehouse request cleanly
          </h2>
          <p className="mt-1 text-[13px] leading-6 text-[#64748b]">
            These are the customer-facing warehouse booking details defined in the PRD.
          </p>
        </div>

        <div className="grid gap-4">
          <Input
            label="Preferred location"
            tone="light"
            value={locationFilter}
            onChange={(event) => setLocationFilter(event.target.value)}
            placeholder="Search city, estate, industrial area, or warehouse code"
            help="Used to narrow warehouse options before final selection."
          />
          <Input
            label="Inbound appointment"
            tone="light"
            type="datetime-local"
            value={appointmentWindow}
            onChange={(event) => setAppointmentWindow(event.target.value)}
            help="Inbound date and time used for warehouse slot planning."
          />
          <Input
            label="Goods description"
            tone="light"
            value={goodsDescription}
            onChange={(event) => setGoodsDescription(event.target.value)}
            placeholder="Palletized FMCG, pharma cartons, frozen stock, machinery..."
          />
          <Input
            label="Expected storage duration"
            tone="light"
            value={expectedDuration}
            onChange={(event) => setExpectedDuration(event.target.value)}
            placeholder="3 days, 2 weeks, 1 month"
          />
          <Input
            label="Weight / volume summary"
            tone="light"
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
            placeholder="Weight, pallet count, cubic meters, or units"
            help="Customer-facing intake only. Detailed commercial logic stays internal."
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {[
            'Storage type',
            'Goods description',
            'Inbound date and time',
            'Expected storage duration',
            'Weight and/or volume',
            'Special handling and insurance when needed',
          ].map((item) => (
            <div
              key={item}
              className="rounded-[16px] bg-[#f8fbff] px-3.5 py-3 text-[13px] font-medium leading-5 text-[#1a1a2e]"
            >
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[22px] border border-[#d7e0ec] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
              Eligible warehouses
            </p>
            <h2 className="mt-1 text-[1.05rem] font-semibold leading-6 text-[#1a1a2e]">
              Warehouse options near your request
            </h2>
          </div>
          <span className="rounded-full bg-[#f1f5fb] px-3 py-1 text-[11px] font-semibold text-[#1b3f72]">
            {filteredWarehouses.length} options
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : filteredWarehouses.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-[#d7e0ec] bg-[#f8fbff] px-4 py-6 text-center">
            <MapPinned className="mx-auto h-6 w-6 text-[#1b3f72]" />
            <p className="mt-3 text-sm font-semibold text-[#1a1a2e]">No warehouse options match yet</p>
            <p className="mt-1 text-xs leading-5 text-[#64748b]">
              Adjust the storage mode or location filter and try again.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredWarehouses.map((warehouse) => {
              const zoneTypes = Array.from(
                new Set((warehouse.zones ?? []).map((zone) => String(zone.type ?? 'DRY').replaceAll('_', ' '))),
              );

              return (
                <div
                  key={warehouse.id}
                  className="rounded-[22px] border border-[#d7e0ec] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                        {warehouse.code}
                      </p>
                      <h3 className="mt-1 text-[1.02rem] font-semibold leading-6 text-[#1a1a2e]">
                        {warehouse.name}
                      </h3>
                      <p className="mt-1 text-[13px] leading-6 text-[#64748b]">
                        {warehouse.address || 'Address will be confirmed by Zito operations.'}
                      </p>
                    </div>

                    <span className="rounded-full bg-[#dcfce7] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#15803d]">
                      {warehouse.status ?? 'ACTIVE'}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-[16px] bg-white px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">
                        Zones
                      </p>
                      <p className="mt-1 text-base font-semibold text-[#1a1a2e]">{warehouse.zones?.length ?? 0}</p>
                    </div>
                    <div className="rounded-[16px] bg-white px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">
                        Stored items
                      </p>
                      <p className="mt-1 text-base font-semibold text-[#1a1a2e]">{warehouse._count?.items ?? 0}</p>
                    </div>
                    <div className="rounded-[16px] bg-white px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">
                        Access
                      </p>
                      <p className="mt-1 text-base font-semibold text-[#1a1a2e]">By review</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {zoneTypes.length ? (
                      zoneTypes.map((zoneType) => (
                        <span
                          key={zoneType}
                          className="rounded-full border border-[#d1dcf0] bg-white px-3 py-1 text-[11px] font-semibold text-[#1b3f72]"
                        >
                          {zoneType}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full border border-[#d1dcf0] bg-white px-3 py-1 text-[11px] font-semibold text-[#1b3f72]">
                        Zone types pending
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex flex-col gap-2">
                    <Link
                      href="/customer/support"
                      className="inline-flex items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(59,130,246,0.16)]"
                    >
                      <CalendarClock className="h-4 w-4" />
                      Request warehouse review
                    </Link>
                    <Link
                      href="/customer/bookings/new"
                      className="inline-flex items-center justify-center gap-2 rounded-[14px] bg-[#0f172a] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1e293b]"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Need transport too?
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
