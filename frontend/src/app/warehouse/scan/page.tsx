'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { BarcodeScanner } from '@/components/scan/BarcodeScanner';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { ApiError, api } from '@/lib/api';
import { formatDateTime, formatStatus } from '@/lib/format';

type WarehouseRecord = {
  id: string;
  name: string;
  zones: Array<{
    racks: Array<{
      bins: Array<{
        id: string;
        label: string;
      }>;
    }>;
  }>;
};

type InventoryItem = {
  id: string;
  parcelId: string;
  status: string;
  warehouseId?: string | null;
};

type ScanPayload = {
  itemId: string;
  checkpoint: string;
  warehouseId?: string;
  binId?: string;
  vehicleId?: string;
  notes?: string;
  deliveryOtp?: string;
  deliveryProofUrl?: string;
  clientReference: string;
  occurredAt: string;
  syncMode: 'ONLINE' | 'OFFLINE';
};

const CHECKPOINT_OPTIONS = [
  'PICKUP',
  'WAREHOUSE_ENTRY',
  'STORAGE',
  'DISPATCH',
  'DELIVERY',
  'VEHICLE_LOAD',
  'VEHICLE_UNLOAD',
];

type ScanSyncResult = {
  accepted: boolean;
  syncResolution: 'CREATED' | 'MERGED_DUPLICATE' | 'REJECTED_STALE';
  reason: string;
};

function createClientReference() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatSyncMessage(result: ScanSyncResult) {
  switch (result.syncResolution) {
    case 'MERGED_DUPLICATE':
      return result.reason || 'Duplicate scan merged into the latest matching checkpoint.';
    case 'REJECTED_STALE':
      return result.reason || 'A newer valid scan already exists, so the stale event was ignored.';
    case 'CREATED':
    default:
      return result.reason || 'Scan checkpoint recorded.';
  }
}

async function syncScanPayload(payload: ScanPayload) {
  if (payload.checkpoint === 'DELIVERY') {
    return api.post<ScanSyncResult>('/scan/confirm-delivery', {
      itemId: payload.itemId,
      vehicleId: payload.vehicleId || undefined,
      deliveryOtp: payload.deliveryOtp,
      deliveryProofUrl: payload.deliveryProofUrl,
      notes: payload.notes || undefined,
      clientReference: payload.clientReference,
      occurredAt: payload.occurredAt,
      syncMode: payload.syncMode,
    }, {
      retry: {
        enabled: true,
        attempts: 4,
      },
    });
  }

  if (payload.checkpoint === 'VEHICLE_LOAD') {
    return api.post<ScanSyncResult>('/scan/vehicle-load', payload, {
      retry: {
        enabled: true,
        attempts: 4,
      },
    });
  }

  if (payload.checkpoint === 'VEHICLE_UNLOAD') {
    return api.post<ScanSyncResult>('/scan/vehicle-unload', payload, {
      retry: {
        enabled: true,
        attempts: 4,
      },
    });
  }

  return api.post<ScanSyncResult>('/scan', payload, {
    retry: {
      enabled: true,
      attempts: 4,
    },
  });
}

export default function WarehouseScanPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [scannedCode, setScannedCode] = useState('');
  const [itemId, setItemId] = useState('');
  const [checkpoint, setCheckpoint] = useState('WAREHOUSE_ENTRY');
  const [warehouseId, setWarehouseId] = useState('');
  const [binId, setBinId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [notes, setNotes] = useState('');
  const [deliveryOtp, setDeliveryOtp] = useState('');
  const [deliveryProofUrl, setDeliveryProofUrl] = useState('');

  const { queue, isOnline, syncing, enqueue, flushQueue } = useOfflineSync<ScanPayload>({
    storageKey: 'zito.offline.scanQueue',
    syncItem: syncScanPayload,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [inventoryResponse, warehouseResponse] = await Promise.all([
        api.get<InventoryItem[]>('/inventory'),
        api.get<WarehouseRecord[]>('/warehouse'),
      ]);

      setItems(inventoryResponse);
      setWarehouses(warehouseResponse);
      if (!warehouseId && warehouseResponse[0]) {
        setWarehouseId(warehouseResponse[0].id);
      }
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Unable to load scan workspace.',
      );
    } finally {
      setLoading(false);
    }
  }, [warehouseId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const bins = useMemo(() => {
    const selectedWarehouse = warehouses.find(
      (warehouse) => warehouse.id === warehouseId,
    );
    return (
      selectedWarehouse?.zones.flatMap((zone) =>
        zone.racks.flatMap((rack) => rack.bins),
      ) ?? []
    );
  }, [warehouseId, warehouses]);

  function resolveItemFromCode(code: string) {
    const trimmed = code.trim();
    const matched = items.find(
      (item) =>
        item.id.toLowerCase() === trimmed.toLowerCase() ||
        item.parcelId.toLowerCase() === trimmed.toLowerCase(),
    );

    setScannedCode(trimmed);
    if (matched) {
      setItemId(matched.id);
      if (matched.warehouseId) {
        setWarehouseId(matched.warehouseId);
      }
      setSuccess(`Resolved ${trimmed} to parcel ${matched.parcelId}.`);
      return;
    }

    setItemId(trimmed);
    setSuccess(`Using ${trimmed} as the direct item id for this scan.`);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!itemId) {
      setError('Scan or enter an item id before recording a checkpoint.');
      return;
    }

    const payload: ScanPayload = {
      itemId,
      checkpoint,
      warehouseId: warehouseId || undefined,
      binId: binId || undefined,
      vehicleId: vehicleId || undefined,
      notes: notes || undefined,
      deliveryOtp: deliveryOtp || undefined,
      deliveryProofUrl: deliveryProofUrl || undefined,
      clientReference: createClientReference(),
      occurredAt: new Date().toISOString(),
      syncMode: isOnline ? 'ONLINE' : 'OFFLINE',
    };

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (!isOnline) {
        enqueue(payload);
        setSuccess('Scan stored offline and will sync when connectivity returns.');
      } else {
        const result = await syncScanPayload(payload);
        setSuccess(formatSyncMessage(result));
      }

      setScannedCode('');
      setItemId('');
      setBinId('');
      setVehicleId('');
      setNotes('');
      setDeliveryOtp('');
      setDeliveryProofUrl('');
      await loadData();
    } catch (caught) {
      if (!(caught instanceof ApiError)) {
        enqueue({
          ...payload,
          syncMode: 'OFFLINE',
        });
        setSuccess('Network issue detected. Scan moved to the offline queue.');
      } else {
        setError(caught.message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleFlushQueue() {
    setError(null);
    setSuccess(null);

    const result = await flushQueue();
    setSuccess(
      `Offline sync complete. ${result.synced} scans synced and ${result.failed} still pending.`,
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Connectivity" value={isOnline ? 'Online' : 'Offline'} helper="Offline queue will buffer scan events." tone={isOnline ? 'success' : 'warning'} />
        <StatCard label="Queued scans" value={String(queue.length)} helper="Pending sync-on-reconnect records." tone={queue.length > 0 ? 'warning' : 'info'} />
        <StatCard label="Inventory visible" value={String(items.length)} helper="Parcels available for scan resolution." />
        <StatCard label="Warehouses" value={String(warehouses.length)} helper="Facilities available for checkpoint context." />
      </div>

      {error ? (
        <Alert title="Scan workspace error" variant="danger">
          {error}
        </Alert>
      ) : null}

      {success ? (
        <Alert title="Scan workspace update" variant="success">
          {success}
        </Alert>
      ) : null}

      <BarcodeScanner onDetected={resolveItemFromCode} />

      <SurfaceCard
        title="Record scan checkpoint"
        description="No scan means no movement. Use the queue when the connection drops."
        actions={
          <Button
            variant="secondary"
            disabled={!isOnline || syncing || queue.length === 0}
            onClick={() => void handleFlushQueue()}
          >
            {syncing ? 'Syncing queue...' : 'Sync offline queue'}
          </Button>
        }
      >
        {loading ? (
          <Spinner />
        ) : (
          <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" onSubmit={handleSubmit}>
            <Input label="Scanned code" value={scannedCode} onChange={(event) => setScannedCode(event.target.value)} help="Parcel barcode or inventory item UUID." />
            <Input label="Resolved item id" value={itemId} onChange={(event) => setItemId(event.target.value)} required />
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Checkpoint</span>
              <select
                className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                value={checkpoint}
                onChange={(event) => setCheckpoint(event.target.value)}
              >
                {CHECKPOINT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {formatStatus(option)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Warehouse</span>
              <select
                className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                value={warehouseId}
                onChange={(event) => setWarehouseId(event.target.value)}
              >
                <option value="">No warehouse</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Bin</span>
              <select
                className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                value={binId}
                onChange={(event) => setBinId(event.target.value)}
              >
                <option value="">No bin</option>
                {bins.map((bin) => (
                  <option key={bin.id} value={bin.id}>
                    {bin.label}
                  </option>
                ))}
              </select>
            </label>
            <Input label="Vehicle id" value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} help="Required for dispatch, load, unload, and delivery flows." />
            <Input label="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
            {checkpoint === 'DELIVERY' ? (
              <>
                <Input label="Delivery OTP" value={deliveryOtp} onChange={(event) => setDeliveryOtp(event.target.value)} required />
                <Input label="Proof URL" value={deliveryProofUrl} onChange={(event) => setDeliveryProofUrl(event.target.value)} required />
              </>
            ) : null}
            <div className="md:col-span-2 xl:col-span-3">
              <Button disabled={saving} type="submit">
                {saving ? 'Saving scan...' : isOnline ? 'Record scan' : 'Queue scan offline'}
              </Button>
            </div>
          </form>
        )}
      </SurfaceCard>

      <SurfaceCard title="Offline queue" description="Scans waiting for connection recovery.">
        <Table
          rows={queue}
          emptyMessage="Offline queue is empty."
          columns={[
            { key: 'item', header: 'Item', render: (entry) => entry.payload.itemId },
            { key: 'checkpoint', header: 'Checkpoint', render: (entry) => formatStatus(entry.payload.checkpoint) },
            { key: 'time', header: 'Queued', render: (entry) => formatDateTime(entry.createdAt) },
            { key: 'error', header: 'Last error', render: (entry) => entry.lastError ?? 'Pending sync' },
          ]}
        />
      </SurfaceCard>
    </div>
  );
}
