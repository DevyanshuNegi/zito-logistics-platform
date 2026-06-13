'use client';

import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { ApiError, api, getApiOrigin, getApiBaseUrl } from '@/lib/api';
import { formatDateTime, formatStatus } from '@/lib/format';

function getFullFileUrl(fileUrl: string) {
  if (fileUrl.startsWith('http')) return fileUrl;
  const normalizedPath = fileUrl.startsWith('/') ? fileUrl.substring(1) : fileUrl;
  if (normalizedPath.startsWith('uploads/')) {
    return `${getApiBaseUrl()}/${normalizedPath}`;
  }
  return `${getApiBaseUrl()}/uploads/${normalizedPath}`;
}

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
  photoType?: string;
  category?: string;
  status: string;
  photoUrl?: string | null;
  fileUrl?: string | null;
  reviewNotes?: string | null;
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
    expiringDocuments?: number;
    expiredDocuments?: number;
    overdueUserReviews?: number;
    overdueVehicleReviews?: number;
    vehiclesMissingPhotos?: number;
    autoSuspendedUsers?: number;
  };
  automation?: {
    lastRunAt?: string;
    alerts?: Array<{
      severity: string;
      title: string;
      detail: string;
    }>;
    autoSuspendedUsers?: Array<{
      id: string;
      role: string;
      subjectLabel: string;
    }>;
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

  async function refreshAutomation() {
    setBusyKey('automation:refresh');
    setError(null);
    setSuccess(null);

    try {
      const response = await api.post<VerificationDashboard>('/users/verification/automation', {});
      setDashboard(response);
      setSuccess('Compliance automation scan refreshed.');
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to refresh compliance automation.',
      );
    } finally {
      setBusyKey(null);
    }
  }

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
        <StatCard label="Expiring docs" value={String(dashboard?.summary.expiringDocuments ?? 0)} helper="Approved documents approaching expiry and needing action." tone="warning" />
        <StatCard label="Overdue reviews" value={String((dashboard?.summary.overdueUserReviews ?? 0) + (dashboard?.summary.overdueVehicleReviews ?? 0))} helper="Compliance reviews older than the desk SLA threshold." tone="info" />
        <StatCard label="Missing photo packs" value={String(dashboard?.summary.vehiclesMissingPhotos ?? 0)} helper="Truck and container units still missing mandatory image evidence." tone="warning" />
        <StatCard label="Auto-suspended" value={String(dashboard?.summary.autoSuspendedUsers ?? 0)} helper="Operational accounts suspended automatically due to expired compliance evidence." tone="danger" />
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
        actions={
          <Button
            disabled={busyKey === 'automation:refresh'}
            onClick={() => void refreshAutomation()}
            variant="secondary"
          >
            {busyKey === 'automation:refresh' ? 'Refreshing...' : 'Refresh automation scan'}
          </Button>
        }
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
                      Not yet approved:{' '}
                      {user.missingDocuments.length > 0
                        ? user.missingDocuments.map(formatStatus).join(', ')
                        : 'All approved ✓'}
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

                        {document.fileUrl ? (
                          <div className="mt-3 overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
                            {document.fileUrl.toLowerCase().endsWith('.pdf') ? (
                              <a
                                href={getFullFileUrl(document.fileUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center p-3 text-xs font-semibold text-cyan-300 hover:text-cyan-100 transition hover:bg-slate-850"
                              >
                                <span className="mr-2">📄</span> View PDF Document
                              </a>
                            ) : (
                              <a
                                href={getFullFileUrl(document.fileUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group relative block aspect-[4/3] w-full overflow-hidden"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={getFullFileUrl(document.fileUrl)}
                                  alt={document.type}
                                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                                  <span className="rounded-lg bg-slate-900/95 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-lg">
                                    View full size ↗
                                  </span>
                                </div>
                              </a>
                            )}
                          </div>
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
        title="Compliance automation"
        description="Operationally important verification issues surfaced automatically for internal intervention."
      >
        {loading && !dashboard ? (
          <Spinner />
        ) : (
          <div className="space-y-4">
            <div className="rounded-[18px] border border-slate-800 bg-slate-950/60 px-4 py-4 text-sm text-slate-300">
              Last scan:{' '}
              <span className="font-semibold text-white">
                {formatDateTime(dashboard?.automation?.lastRunAt)}
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {(dashboard?.automation?.alerts ?? []).length > 0 ? (
                (dashboard?.automation?.alerts ?? []).map((alert) => (
                  <div
                    key={`${alert.severity}:${alert.title}`}
                    className="rounded-[18px] border border-slate-800 bg-slate-950/70 px-4 py-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {formatStatus(alert.severity)}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-white">{alert.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{alert.detail}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-[18px] border border-dashed border-slate-700/50 bg-slate-950/60 px-4 py-5 text-sm text-slate-400">
                  No active automation alerts right now.
                </div>
              )}
            </div>

            {(dashboard?.automation?.autoSuspendedUsers ?? []).length > 0 ? (
              <div className="rounded-[18px] border border-rose-500/20 bg-rose-500/10 px-4 py-4">
                <p className="text-sm font-semibold text-rose-100">Auto-suspended operational accounts</p>
                <div className="mt-3 space-y-2 text-sm text-rose-50/90">
                  {(dashboard?.automation?.autoSuspendedUsers ?? []).map((user) => (
                    <p key={user.id}>
                      {user.subjectLabel} - {formatStatus(user.role)}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </SurfaceCard>

      <SurfaceCard
        title="Fleet verification desk"
        description="Heavy vehicles and container trucks must complete the inspection photo and Kenya compliance document packet before final approval."
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
                      const photo = vehicle.verificationPhotos.find(
                        (item) => (item.photoType ?? item.category) === category,
                      );
                      const note = photo?.reviewNotes ?? photo?.reviewNote;

                      return (
                        <div key={category} className="rounded-[16px] border border-slate-800 bg-slate-950/70 p-3">
                          <p className="text-sm font-semibold text-white">{formatStatus(category)}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {photo ? `Status: ${formatStatus(photo.status)}` : 'Upload missing'}
                          </p>
                          {note ? (
                            <p className="mt-2 text-xs text-slate-300">Note: {note}</p>
                          ) : null}
                          {photo?.rejectionReason ? (
                            <p className="mt-2 text-xs text-rose-400">Reason: {photo.rejectionReason}</p>
                          ) : null}

                          {photo && (photo.photoUrl ?? photo.fileUrl) ? (
                            <div className="mt-3 overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
                              {(photo.photoUrl ?? photo.fileUrl)!.toLowerCase().endsWith('.pdf') ? (
                                <a
                                  href={getFullFileUrl(photo.photoUrl ?? photo.fileUrl ?? '')}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-center p-3 text-xs font-semibold text-cyan-300 hover:text-cyan-100 transition hover:bg-slate-850"
                                >
                                  <span className="mr-2">📄</span> View PDF Document
                                </a>
                              ) : (
                                <a
                                  href={getFullFileUrl(photo.photoUrl ?? photo.fileUrl ?? '')}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="group relative block aspect-[4/3] w-full overflow-hidden"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={getFullFileUrl(photo.photoUrl ?? photo.fileUrl ?? '')}
                                    alt={category}
                                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                                    <span className="rounded-lg bg-slate-900/95 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-lg">
                                      View full size ↗
                                    </span>
                                  </div>
                                </a>
                              )}
                            </div>
                          ) : null}

                          {photo ? (
                            <div className="mt-3 grid gap-2">
                              <Button
                                className="w-full"
                                disabled={busyKey === `photo:${photo.id}:APPROVED`}
                                onClick={() => void handlePhotoReview(vehicle.id, photo.id, 'APPROVED')}
                              >
                                {busyKey === `photo:${photo.id}:APPROVED` ? 'Updating...' : 'Approve upload'}
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
                                  : 'Request resubmission'}
                              </Button>
                              <Button
                                className="w-full"
                                disabled={busyKey === `photo:${photo.id}:REJECTED`}
                                variant="danger"
                                onClick={() => void handlePhotoReview(vehicle.id, photo.id, 'REJECTED')}
                              >
                                {busyKey === `photo:${photo.id}:REJECTED` ? 'Updating...' : 'Reject upload'}
                              </Button>
                            </div>
                          ) : (
                            <p className="mt-3 text-xs text-amber-300">Waiting for partner upload.</p>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-slate-300">This vehicle type does not require the full truck inspection packet.</p>
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
