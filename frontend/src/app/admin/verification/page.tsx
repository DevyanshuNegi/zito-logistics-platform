'use client';

import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { ApiError, api } from '@/lib/api';
import { formatDateTime, formatStatus } from '@/lib/format';

type VerificationDocument = {
  id: string;
  type: string;
  status: string;
  fileUrl?: string | null;
  documentNumber?: string | null;
  documentSide?: string | null;
  expiryDate?: string | null;
  reviewNote?: string | null;
  rejectionReason?: string | null;
  verifiedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type VerificationUser = {
  id: string;
  fullName?: string | null;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  role: string;
  status: string;
  requiredDocuments: string[];
  missingDocuments: string[];
  pendingDocumentsCount: number;
  kycDocuments: VerificationDocument[];
};

type VerificationPhoto = {
  id: string;
  category: string;
  status: string;
  fileUrl?: string | null;
  reviewNote?: string | null;
  rejectionReason?: string | null;
  reviewedAt?: string | null;
};

type VerificationVehicle = {
  id: string;
  plateNumber: string;
  type: string;
  status: string;
  verificationStatus: string;
  verificationReviewedAt?: string | null;
  verificationNote?: string | null;
  rejectionReason?: string | null;
  requiredPhotoCategories: string[];
  missingPhotoCategories: string[];
  ownerUser?: {
    fullName?: string | null;
    companyName?: string | null;
    role?: string | null;
    phone?: string | null;
  } | null;
  driver?: {
    user?: {
      fullName?: string | null;
      phone?: string | null;
    } | null;
  } | null;
  verificationPhotos: VerificationPhoto[];
};

type VerificationDashboard = {
  summary: {
    usersAwaitingReview: number;
    rejectedUsers: number;
    vehiclesAwaitingReview: number;
    rejectedVehicles: number;
  };
  users: VerificationUser[];
  vehicles: VerificationVehicle[];
};

function reviewPrompt(status: 'APPROVED' | 'REJECTED' | 'RESUBMISSION_REQUIRED') {
  if (status === 'APPROVED') {
    return { note: undefined, reason: undefined };
  }

  const label = status === 'REJECTED' ? 'rejection reason' : 'resubmission reason';
  const reason = window.prompt(`Enter ${label}:`)?.trim();
  if (!reason) {
    return null;
  }

  return {
    note: reason,
    reason,
  };
}

export default function AdminVerificationPage() {
  const [dashboard, setDashboard] = useState<VerificationDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadDashboard() {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<VerificationDashboard>('/users/verification/dashboard');
      setDashboard(response);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load verification control desk.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function handleDocumentReview(
    userId: string,
    documentId: string,
    status: 'APPROVED' | 'REJECTED' | 'RESUBMISSION_REQUIRED',
  ) {
    const review = reviewPrompt(status);
    if (status !== 'APPROVED' && !review) {
      return;
    }

    const key = `doc:${documentId}:${status}`;
    setBusyKey(key);
    setError(null);
    setSuccess(null);

    try {
      await api.patch(`/users/${userId}/kyc/${documentId}/verify`, {
        status,
        note: review?.note,
        reason: review?.reason,
      });
      setSuccess(`Document marked ${formatStatus(status)}.`);
      await loadDashboard();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to review KYC document.');
    } finally {
      setBusyKey(null);
    }
  }

  async function handlePhotoReview(
    vehicleId: string,
    photoId: string,
    status: 'APPROVED' | 'REJECTED' | 'RESUBMISSION_REQUIRED',
  ) {
    const review = reviewPrompt(status);
    if (status !== 'APPROVED' && !review) {
      return;
    }

    const key = `photo:${photoId}:${status}`;
    setBusyKey(key);
    setError(null);
    setSuccess(null);

    try {
      await api.patch(`/fleet/${vehicleId}/verification-photos/${photoId}/review`, {
        status,
        note: review?.note,
        reason: review?.reason,
      });
      setSuccess(`Photo marked ${formatStatus(status)}.`);
      await loadDashboard();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to review vehicle photo.');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleVehicleReview(
    vehicleId: string,
    status: 'APPROVED' | 'REJECTED' | 'RESUBMISSION_REQUIRED',
  ) {
    const review = reviewPrompt(status);
    if (status !== 'APPROVED' && !review) {
      return;
    }

    const key = `vehicle:${vehicleId}:${status}`;
    setBusyKey(key);
    setError(null);
    setSuccess(null);

    try {
      await api.patch(`/fleet/${vehicleId}/verification`, {
        status,
        note: review?.note,
        reason: review?.reason,
      });
      setSuccess(`Vehicle marked ${formatStatus(status)}.`);
      await loadDashboard();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to review vehicle verification.');
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Users awaiting review" value={String(dashboard?.summary.usersAwaitingReview ?? 0)} helper="Accounts with missing or pending KYC evidence." tone="warning" />
        <StatCard label="Rejected users" value={String(dashboard?.summary.rejectedUsers ?? 0)} helper="Accounts blocked until compliance issues are corrected." tone="danger" />
        <StatCard label="Vehicles awaiting review" value={String(dashboard?.summary.vehiclesAwaitingReview ?? 0)} helper="Fleet units still missing approved verification evidence." tone="info" />
        <StatCard label="Rejected vehicles" value={String(dashboard?.summary.rejectedVehicles ?? 0)} helper="Units requiring corrected photos or compliance evidence." tone="danger" />
      </div>

      {error ? (
        <Alert title="Verification control error" variant="danger">
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert title="Verification control updated" variant="success">
          {success}
        </Alert>
      ) : null}

      <SurfaceCard
        title="User compliance review"
        description="Review customer, driver, transporter, courier company, warehouse, and corporate KYC documents before activation."
      >
        {loading && !dashboard ? (
          <Spinner />
        ) : (
          <div className="space-y-4">
            {(dashboard?.users ?? []).map((user) => (
              <article key={user.id} className="rounded-[20px] border border-slate-800 bg-slate-950/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-white">
                      {user.fullName ?? user.companyName ?? 'Unnamed account'}
                    </p>
                    <p className="text-sm text-slate-300">
                      {formatStatus(user.role)} · Current account status: {formatStatus(user.status)}
                    </p>
                    <p className="text-xs text-slate-400">
                      {user.email ?? user.phone ?? user.id}
                    </p>
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    <p>Required docs: {user.requiredDocuments.map(formatStatus).join(', ')}</p>
                    <p>
                      Missing docs:{' '}
                      {user.missingDocuments.length > 0
                        ? user.missingDocuments.map(formatStatus).join(', ')
                        : 'None'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {user.kycDocuments.length > 0 ? (
                    user.kycDocuments.map((document) => (
                      <div key={document.id} className="rounded-[16px] border border-slate-800 bg-slate-950/70 p-3">
                        <p className="text-sm font-semibold text-white">{formatStatus(document.type)}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          Status: {formatStatus(document.status)}
                          {document.documentSide ? ` · ${formatStatus(document.documentSide)}` : ''}
                        </p>
                        {document.documentNumber ? (
                          <p className="mt-1 text-xs text-slate-400">Doc no: {document.documentNumber}</p>
                        ) : null}
                        {document.expiryDate ? (
                          <p className="mt-1 text-xs text-slate-400">Expiry: {formatDateTime(document.expiryDate)}</p>
                        ) : null}
                        {document.reviewNote ? (
                          <p className="mt-2 text-xs text-slate-300">Note: {document.reviewNote}</p>
                        ) : null}
                        {document.rejectionReason ? (
                          <p className="mt-2 text-xs text-rose-400">Reason: {document.rejectionReason}</p>
                        ) : null}

                        <div className="mt-3 grid gap-2">
                          <Button
                            className="w-full"
                            disabled={busyKey === `doc:${document.id}:APPROVED`}
                            onClick={() => void handleDocumentReview(user.id, document.id, 'APPROVED')}
                          >
                            {busyKey === `doc:${document.id}:APPROVED` ? 'Updating...' : 'Approve'}
                          </Button>
                          <Button
                            className="w-full"
                            disabled={busyKey === `doc:${document.id}:RESUBMISSION_REQUIRED`}
                            variant="secondary"
                            onClick={() =>
                              void handleDocumentReview(user.id, document.id, 'RESUBMISSION_REQUIRED')
                            }
                          >
                            {busyKey === `doc:${document.id}:RESUBMISSION_REQUIRED`
                              ? 'Updating...'
                              : 'Request resubmission'}
                          </Button>
                          <Button
                            className="w-full"
                            disabled={busyKey === `doc:${document.id}:REJECTED`}
                            variant="danger"
                            onClick={() => void handleDocumentReview(user.id, document.id, 'REJECTED')}
                          >
                            {busyKey === `doc:${document.id}:REJECTED` ? 'Updating...' : 'Reject'}
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-300">No KYC documents uploaded yet.</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </SurfaceCard>

      <SurfaceCard
        title="Fleet verification desk"
        description="Heavy vehicles and container trucks must complete the five-photo verification packet before final approval."
      >
        {loading && !dashboard ? (
          <Spinner />
        ) : (
          <div className="space-y-4">
            {(dashboard?.vehicles ?? []).map((vehicle) => (
              <article key={vehicle.id} className="rounded-[20px] border border-slate-800 bg-slate-950/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-white">{vehicle.plateNumber}</p>
                    <p className="text-sm text-slate-300">
                      {formatStatus(vehicle.type)} · Ops status: {formatStatus(vehicle.status)} ·
                      Verification: {formatStatus(vehicle.verificationStatus)}
                    </p>
                    <p className="text-xs text-slate-400">
                      Owner:{' '}
                      {vehicle.ownerUser?.companyName ??
                        vehicle.ownerUser?.fullName ??
                        'Unassigned owner'}
                      {vehicle.ownerUser?.role ? ` (${formatStatus(vehicle.ownerUser.role)})` : ''}
                    </p>
                    {vehicle.driver?.user?.fullName ? (
                      <p className="text-xs text-slate-400">Assigned driver: {vehicle.driver.user.fullName}</p>
                    ) : null}
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    <p>
                      Missing photos:{' '}
                      {vehicle.missingPhotoCategories.length > 0
                        ? vehicle.missingPhotoCategories.map(formatStatus).join(', ')
                        : 'None'}
                    </p>
                    <p>Last reviewed: {formatDateTime(vehicle.verificationReviewedAt)}</p>
                  </div>
                </div>

                {vehicle.verificationNote ? (
                  <p className="mt-2 text-sm text-slate-300">Note: {vehicle.verificationNote}</p>
                ) : null}
                {vehicle.rejectionReason ? (
                  <p className="mt-2 text-sm text-rose-400">Reason: {vehicle.rejectionReason}</p>
                ) : null}

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {vehicle.requiredPhotoCategories.length > 0 ? (
                    vehicle.requiredPhotoCategories.map((category) => {
                      const photo = vehicle.verificationPhotos.find((item) => item.category === category);

                      return (
                        <div key={category} className="rounded-[16px] border border-slate-800 bg-slate-950/70 p-3">
                          <p className="text-sm font-semibold text-white">{formatStatus(category)}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {photo ? `Status: ${formatStatus(photo.status)}` : 'Photo missing'}
                          </p>
                          {photo?.reviewNote ? (
                            <p className="mt-2 text-xs text-slate-300">Note: {photo.reviewNote}</p>
                          ) : null}
                          {photo?.rejectionReason ? (
                            <p className="mt-2 text-xs text-rose-400">Reason: {photo.rejectionReason}</p>
                          ) : null}

                          {photo ? (
                            <div className="mt-3 grid gap-2">
                              <Button
                                className="w-full"
                                disabled={busyKey === `photo:${photo.id}:APPROVED`}
                                onClick={() => void handlePhotoReview(vehicle.id, photo.id, 'APPROVED')}
                              >
                                {busyKey === `photo:${photo.id}:APPROVED` ? 'Updating...' : 'Approve photo'}
                              </Button>
                              <Button
                                className="w-full"
                                disabled={busyKey === `photo:${photo.id}:RESUBMISSION_REQUIRED`}
                                variant="secondary"
                                onClick={() =>
                                  void handlePhotoReview(vehicle.id, photo.id, 'RESUBMISSION_REQUIRED')
                                }
                              >
                                {busyKey === `photo:${photo.id}:RESUBMISSION_REQUIRED`
                                  ? 'Updating...'
                                  : 'Request new photo'}
                              </Button>
                              <Button
                                className="w-full"
                                disabled={busyKey === `photo:${photo.id}:REJECTED`}
                                variant="danger"
                                onClick={() => void handlePhotoReview(vehicle.id, photo.id, 'REJECTED')}
                              >
                                {busyKey === `photo:${photo.id}:REJECTED` ? 'Updating...' : 'Reject photo'}
                              </Button>
                            </div>
                          ) : (
                            <p className="mt-3 text-xs text-amber-300">Waiting for partner upload.</p>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-slate-300">This vehicle type does not require the five-photo truck verification packet.</p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    disabled={busyKey === `vehicle:${vehicle.id}:APPROVED`}
                    onClick={() => void handleVehicleReview(vehicle.id, 'APPROVED')}
                  >
                    {busyKey === `vehicle:${vehicle.id}:APPROVED` ? 'Updating...' : 'Approve vehicle'}
                  </Button>
                  <Button
                    disabled={busyKey === `vehicle:${vehicle.id}:RESUBMISSION_REQUIRED`}
                    variant="secondary"
                    onClick={() => void handleVehicleReview(vehicle.id, 'RESUBMISSION_REQUIRED')}
                  >
                    {busyKey === `vehicle:${vehicle.id}:RESUBMISSION_REQUIRED`
                      ? 'Updating...'
                      : 'Request resubmission'}
                  </Button>
                  <Button
                    disabled={busyKey === `vehicle:${vehicle.id}:REJECTED`}
                    variant="danger"
                    onClick={() => void handleVehicleReview(vehicle.id, 'REJECTED')}
                  >
                    {busyKey === `vehicle:${vehicle.id}:REJECTED` ? 'Updating...' : 'Reject vehicle'}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}
