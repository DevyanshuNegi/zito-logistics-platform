'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { ApiError, api } from '@/lib/api';
import { compactId, formatDateTime, formatStatus } from '@/lib/format';

type InventoryDetail = {
  id: string;
  parcelId: string;
  ownerId: string;
  status: string;
  weight: number;
  isFragile: boolean;
  isHazmat: boolean;
  dimensions?: string | null;
  booking?: {
    id?: string;
    reference?: string | null;
    status?: string | null;
  } | null;
  warehouse?: {
    name?: string | null;
  } | null;
  bin?: {
    label?: string | null;
  } | null;
  scanEvents: Array<{
    id: string;
    checkpoint: string;
    vehicleId?: string | null;
    createdAt: string;
    notes?: string | null;
  }>;
  movements: Array<{
    id: string;
    status: string;
    locationDescription: string;
    remarks?: string | null;
    createdAt: string;
  }>;
};

export default function WarehouseInventoryDetailPage() {
  const params = useParams<{ itemId: string }>();
  const itemId = typeof params?.itemId === 'string' ? params.itemId : '';
  const [item, setItem] = useState<InventoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!itemId) {
      return;
    }

    async function loadItem() {
      setLoading(true);
      setError(null);

      try {
        const response = await api.get<InventoryDetail>(`/inventory/${itemId}`);
        setItem(response);
      } catch (caught) {
        setError(
          caught instanceof ApiError
            ? caught.message
            : 'Unable to load inventory item detail.',
        );
      } finally {
        setLoading(false);
      }
    }

    void loadItem();
  }, [itemId]);

  if (loading) {
    return <Spinner />;
  }

  if (error || !item) {
    return (
      <Alert title="Inventory detail error" variant="danger">
        {error ?? 'Inventory item not found.'}
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Parcel" value={item.parcelId} helper={compactId(item.id)} />
        <StatCard label="Status" value={formatStatus(item.status)} helper={item.booking?.reference ?? 'No booking reference'} tone="info" />
        <StatCard label="Storage" value={item.bin?.label ?? 'No bin'} helper={item.warehouse?.name ?? 'No warehouse'} />
        <StatCard label="Trail entries" value={String(item.movements.length)} helper={`${item.scanEvents.length} scan events captured.`} tone="success" />
      </div>

      <SurfaceCard title="Parcel profile" description="Current storage, booking, and handling metadata.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 text-sm text-slate-300">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Owner</p>
            <p className="mt-2 text-white">{compactId(item.ownerId)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Weight</p>
            <p className="mt-2 text-white">{item.weight.toFixed(2)} kg</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Fragile / Hazmat</p>
            <p className="mt-2 text-white">
              {item.isFragile ? 'Fragile' : 'Standard'} / {item.isHazmat ? 'Hazmat' : 'Standard'}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Dimensions</p>
            <p className="mt-2 text-white">{item.dimensions ?? 'Not supplied'}</p>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard title="Movement history" description="Full inventory movement trail for the selected parcel.">
        <Table
          rows={item.movements}
          columns={[
            { key: 'status', header: 'Status', render: (movement) => formatStatus(movement.status) },
            { key: 'location', header: 'Location', render: (movement) => movement.locationDescription },
            { key: 'remarks', header: 'Remarks', render: (movement) => movement.remarks ?? 'No remarks' },
            { key: 'time', header: 'Recorded', render: (movement) => formatDateTime(movement.createdAt) },
          ]}
        />
      </SurfaceCard>

      <SurfaceCard title="Recent scan events" description="Checkpoint history captured by the scan system.">
        <Table
          rows={item.scanEvents}
          emptyMessage="No scan events captured for this parcel yet."
          columns={[
            { key: 'checkpoint', header: 'Checkpoint', render: (scan) => formatStatus(scan.checkpoint) },
            { key: 'vehicle', header: 'Vehicle', render: (scan) => scan.vehicleId ?? 'No vehicle linked' },
            { key: 'notes', header: 'Notes', render: (scan) => scan.notes ?? 'No notes' },
            { key: 'time', header: 'Recorded', render: (scan) => formatDateTime(scan.createdAt) },
          ]}
        />
      </SurfaceCard>
    </div>
  );
}
