'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { WarehousePinPicker } from '@/components/maps/WarehousePinPicker';
import { useAuth } from '@/hooks/useAuth';
import { ApiError, api } from '@/lib/api';
import { compactId, formatStatus } from '@/lib/format';

type Agency = {
  id: string;
  name: string;
  address?: string | null;
  status?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  _count?: {
    users?: number;
    bookings?: number;
    staff?: number;
  };
};

export default function AdminAgenciesPage() {
  const { user } = useAuth();
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');

  const canManage = user?.role === 'SUPER_ADMIN';

  async function loadAgencies() {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<Agency[]>('/agencies');
      setAgencies(response);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load agencies.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAgencies();
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await api.post('/agencies', {
        name,
        address: address || undefined,
        latitude: latitude ? Number(latitude) : undefined,
        longitude: longitude ? Number(longitude) : undefined,
      });

      setName('');
      setAddress('');
      setLatitude('');
      setLongitude('');
      await loadAgencies();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to create agency.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id: string) {
    setError(null);

    try {
      await api.patch(`/agencies/${id}/deactivate`);
      await loadAgencies();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to deactivate agency.');
    }
  }

  const activeCount = agencies.filter((agency) => agency.status === 'ACTIVE').length;
  const bookingCount = agencies.reduce((sum, agency) => sum + (agency._count?.bookings ?? 0), 0);
  const staffCount = agencies.reduce((sum, agency) => sum + (agency._count?.staff ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Agencies" value={String(agencies.length)} helper="Registered agencies in the platform." />
        <StatCard label="Active" value={String(activeCount)} helper="Currently active operations units." tone="success" />
        <StatCard label="Coverage" value={`${staffCount} staff / ${bookingCount} bookings`} helper="Quick footprint snapshot." tone="info" />
      </div>

      {error ? (
        <Alert title="Agency workflow error" variant="danger">
          {error}
        </Alert>
      ) : null}

      <SurfaceCard
        title="Agency setup"
        description="Create or deactivate agencies according to the Phase 1 admin checklist."
      >
        {canManage ? (
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreate}>
            <Input label="Agency name" value={name} onChange={(event) => setName(event.target.value)} required />
            <Input label="Address" value={address} onChange={(event) => setAddress(event.target.value)} />
            <div className="md:col-span-2">
              <WarehousePinPicker
                title="Agency map location"
                searchLabel="Search agency area"
                searchPlaceholder="Search branch, road, city, or landmark"
                address={address}
                latitude={latitude}
                longitude={longitude}
                onAddressChange={setAddress}
                onChange={(point) => {
                  setLatitude(point.latitude);
                  setLongitude(point.longitude);
                }}
              />
            </div>
            <div className="md:col-span-2">
              <Button disabled={saving} type="submit">
                {saving ? 'Creating agency...' : 'Create agency'}
              </Button>
            </div>
          </form>
        ) : (
          <Alert title="Read-only for admins" variant="info">
            Super Admins can create or deactivate agencies. Admins can still review the current setup below.
          </Alert>
        )}
      </SurfaceCard>

      <SurfaceCard title="Agency dashboard" description="Operational footprint across users, staff, and bookings.">
        {loading ? (
          <Spinner />
        ) : (
          <Table
            rows={agencies}
            columns={[
              {
                key: 'agency',
                header: 'Agency',
                render: (agency) => (
                  <div>
                    <p className="font-semibold text-white">{agency.name}</p>
                    <p className="text-xs text-slate-400">{compactId(agency.id)}</p>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (agency) => formatStatus(agency.status),
              },
              {
                key: 'address',
                header: 'Address',
                render: (agency) => agency.address ?? 'No address provided',
              },
              {
                key: 'counts',
                header: 'Counts',
                render: (agency) =>
                  `${agency._count?.users ?? 0} users / ${agency._count?.staff ?? 0} staff / ${agency._count?.bookings ?? 0} bookings`,
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (agency) =>
                  canManage && agency.status === 'ACTIVE' ? (
                    <Button variant="danger" onClick={() => void handleDeactivate(agency.id)}>
                      Deactivate
                    </Button>
                  ) : (
                    <span className="text-slate-400">No action</span>
                  ),
              },
            ]}
          />
        )}
      </SurfaceCard>
    </div>
  );
}
