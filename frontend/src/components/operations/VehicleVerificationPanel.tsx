'use client';

import { ChangeEvent, useMemo, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { ApiError, api } from '@/lib/api';
import { formatStatus } from '@/lib/format';

const REQUIRED_TRUCK_PHOTOS = ['DASHBOARD', 'FRONT', 'RIGHT', 'LEFT', 'BACK'] as const;
const TRUCK_TYPES = new Set([
  'TRUCK_3T',
  'TRUCK_7T',
  'TRUCK_14T',
  'TRUCK_22T',
  'CONTAINER_20FT',
  'CONTAINER_40FT',
  'REFRIGERATED',
]);

type VehicleVerificationPhoto = {
  id?: string;
  category: string;
  status?: string | null;
  reviewNote?: string | null;
  rejectionReason?: string | null;
  fileUrl?: string | null;
};

type VehicleVerificationRecord = {
  id: string;
  plateNumber: string;
  type: string;
  verificationStatus?: string | null;
  verificationPhotos?: VehicleVerificationPhoto[] | null;
};

type VehicleVerificationPanelProps = {
  title: string;
  description: string;
  vehicles: VehicleVerificationRecord[];
  tone?: 'dark' | 'light';
  onChange?: () => void | Promise<void>;
};

function getRequiredPhotoCategories(vehicleType: string) {
  return TRUCK_TYPES.has(vehicleType) ? [...REQUIRED_TRUCK_PHOTOS] : [];
}

export function VehicleVerificationPanel({
  title,
  description,
  vehicles,
  tone = 'dark',
  onChange,
}: VehicleVerificationPanelProps) {
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File | null>>({});
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verifiableVehicles = useMemo(
    () => vehicles.filter((vehicle) => getRequiredPhotoCategories(vehicle.type).length > 0),
    [vehicles],
  );

  function handleFileChange(vehicleId: string, category: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFiles((current) => ({
      ...current,
      [`${vehicleId}:${category}`]: file,
    }));
  }

  async function handleUpload(vehicleId: string, category: string) {
    const key = `${vehicleId}:${category}`;
    const file = selectedFiles[key];
    if (!file) {
      setError('Choose a photo first before uploading.');
      return;
    }

    const formData = new FormData();
    formData.append('category', category);
    formData.append('file', file);

    setUploadingKey(key);
    setError(null);
    setMessage(null);

    try {
      await api.post(`/fleet/${vehicleId}/verification-photos`, formData);
      setMessage(`${formatStatus(category)} photo uploaded for review.`);
      setSelectedFiles((current) => ({
        ...current,
        [key]: null,
      }));
      await onChange?.();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to upload verification photo.');
    } finally {
      setUploadingKey(null);
    }
  }

  return (
    <SurfaceCard title={title} description={description} tone={tone}>
      {error ? (
        <Alert title="Vehicle verification error" variant="danger">
          {error}
        </Alert>
      ) : null}
      {message ? (
        <Alert title="Vehicle verification updated" variant="success">
          {message}
        </Alert>
      ) : null}

      {verifiableVehicles.length === 0 ? (
        <p className={tone === 'light' ? 'text-sm text-slate-600' : 'text-sm text-slate-300'}>
          Truck and container verification is enabled, but this fleet does not yet have a vehicle
          type that requires the compulsory five-photo package.
        </p>
      ) : (
        <div className="space-y-4">
          {verifiableVehicles.map((vehicle) => {
            const requiredCategories = getRequiredPhotoCategories(vehicle.type);
            const existingPhotos = new Map(
              (vehicle.verificationPhotos ?? []).map((photo) => [photo.category, photo]),
            );
            const approvedCount = requiredCategories.filter((category) => {
              const photo = existingPhotos.get(category);
              return String(photo?.status ?? '').toUpperCase() === 'APPROVED';
            }).length;

            return (
              <article
                key={vehicle.id}
                className={
                  tone === 'light'
                    ? 'rounded-[20px] border border-[#d7e0ec] bg-[#f8fbff] p-4'
                    : 'rounded-[20px] border border-slate-800/80 bg-slate-950/40 p-4'
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className={tone === 'light' ? 'text-lg font-semibold text-[#1a1a2e]' : 'text-lg font-semibold text-white'}>
                      {vehicle.plateNumber}
                    </p>
                    <p className={tone === 'light' ? 'text-sm text-slate-600' : 'text-sm text-slate-300'}>
                      {formatStatus(vehicle.type)} · Vehicle review status:{' '}
                      {formatStatus(vehicle.verificationStatus ?? 'PENDING_REVIEW')}
                    </p>
                  </div>
                  <p className={tone === 'light' ? 'text-xs text-slate-500' : 'text-xs text-slate-400'}>
                    {approvedCount}/{requiredCategories.length} compulsory truck photos approved
                  </p>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {requiredCategories.map((category) => {
                    const key = `${vehicle.id}:${category}`;
                    const existing = existingPhotos.get(category);

                    return (
                      <div
                        key={category}
                        className={
                          tone === 'light'
                            ? 'rounded-[16px] border border-[#d7e0ec] bg-white p-3'
                            : 'rounded-[16px] border border-slate-800 bg-slate-950/70 p-3'
                        }
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className={tone === 'light' ? 'text-sm font-semibold text-[#1a1a2e]' : 'text-sm font-semibold text-white'}>
                              {formatStatus(category)}
                            </p>
                            <p className={tone === 'light' ? 'text-xs text-slate-500' : 'text-xs text-slate-400'}>
                              {existing
                                ? `Current status: ${formatStatus(existing.status ?? 'PENDING_REVIEW')}`
                                : 'Not uploaded yet'}
                            </p>
                          </div>
                        </div>

                        {existing?.reviewNote ? (
                          <p className={tone === 'light' ? 'mt-2 text-xs text-slate-600' : 'mt-2 text-xs text-slate-300'}>
                            Note: {existing.reviewNote}
                          </p>
                        ) : null}
                        {existing?.rejectionReason ? (
                          <p className="mt-2 text-xs text-rose-400">Reason: {existing.rejectionReason}</p>
                        ) : null}

                        <div className="mt-3 space-y-3">
                          <input
                            accept="image/jpeg,image/png"
                            className={
                              tone === 'light'
                                ? 'block w-full text-xs text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-[#1b3f72] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white'
                                : 'block w-full text-xs text-slate-300 file:mr-3 file:rounded-full file:border-0 file:bg-sky-500/20 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-sky-100'
                            }
                            type="file"
                            onChange={(event) => handleFileChange(vehicle.id, category, event)}
                          />
                          <Button
                            className="w-full"
                            disabled={uploadingKey === key || !selectedFiles[key]}
                            onClick={() => void handleUpload(vehicle.id, category)}
                          >
                            {uploadingKey === key ? 'Uploading...' : `Upload ${formatStatus(category)}`}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </SurfaceCard>
  );
}
