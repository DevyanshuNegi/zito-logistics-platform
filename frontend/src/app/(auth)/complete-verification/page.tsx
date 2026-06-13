'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AuthShell } from '@/components/layout/AuthShell';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { ApiError, api } from '@/lib/api';
import { getRoleHomePath } from '@/lib/roles';
import { formatStatus } from '@/lib/format';

type RequiredDocument = {
  type: string;
  label: string;
  required: boolean;
  status: string;
  documentId?: string | null;
  rejectionReason?: string | null;
  reviewNote?: string | null;
  uploadedAt?: string | null;
};

type VerificationSummary = {
  role: string;
  status: string;
  requiredDocuments: RequiredDocument[];
  missingDocuments: string[];
  uploadedCount: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  totalRequired: number;
  canSubmit: boolean;
  nextStep: string;
};

function getStatusClasses(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === 'APPROVED') return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100';
  if (normalized === 'PENDING' || normalized === 'PENDING_REVIEW') return 'border-amber-400/30 bg-amber-400/10 text-amber-100';
  if (normalized === 'REJECTED' || normalized === 'RESUBMISSION_REQUIRED') return 'border-rose-400/30 bg-rose-400/10 text-rose-100';
  return 'border-slate-600 bg-slate-900/70 text-slate-300';
}

export default function CompleteVerificationPage() {
  const { user, accessToken, logout } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<VerificationSummary | null>(null);
  const [selectedType, setSelectedType] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const progress = useMemo(() => {
    if (!summary?.totalRequired) return 0;
    return Math.round((summary.uploadedCount / summary.totalRequired) * 100);
  }, [summary]);

  const loadSummary = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await api.get<VerificationSummary>('/users/me/verification');
      setSummary(response);
      setSelectedType((current) => current || response.requiredDocuments[0]?.type || '');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load verification requirements.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const nextUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [selectedFile]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setError(null);
    setMessage(null);
  }

  async function uploadSelectedDocument() {
    if (!selectedType || !selectedFile) {
      setError('Choose a required document and capture a live camera photo first.');
      return;
    }

    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append('documentType', selectedType);
      formData.append('captureSource', 'CAMERA');
      formData.append('capturedAt', new Date().toISOString());
      formData.append('file', selectedFile);

      await api.post('/users/me/kyc', formData);
      setSelectedFile(null);
      setMessage('Document saved as draft. Continue until all required items are uploaded.');
      await loadSummary();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to upload document.');
    } finally {
      setUploading(false);
    }
  }

  async function submitForReview() {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await api.post<{ message: string; data: VerificationSummary }>('/users/me/kyc/submit', {});
      setSummary(response.data);
      setMessage(response.message || 'KYC submitted for review.');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to submit KYC for review.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!user || !accessToken) {
    return (
      <AuthShell eyebrow="Complete Verification" title="Sign in to continue" subtitle="Your verification checklist is tied to your account role.">
        <Link href="/login">
          <Button className="w-full">Back to login</Button>
        </Link>
      </AuthShell>
    );
  }

  if (user.status === 'ACTIVE') {
    return (
      <AuthShell eyebrow="Verification Complete" title="Your account is active" subtitle="You can access your workspace now.">
        <Link href={getRoleHomePath(user.role, user.staffScope)}>
          <Button className="w-full">Open dashboard</Button>
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Complete Verification"
      title="Finish account verification"
      subtitle="Upload the role-based documents required for review and activation."
    >
      <div className="space-y-5">
        {error ? <Alert title="Verification issue" variant="danger">{error}</Alert> : null}
        {message ? <Alert title="Saved" variant="success">{message}</Alert> : null}

        <div className="rounded-3xl border border-slate-700/50 bg-slate-950/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-cyan-200">{formatStatus(summary?.role ?? user.role)}</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Verification progress</h2>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClasses(summary?.status ?? user.status ?? 'PENDING')}`}>
              {formatStatus(summary?.status ?? user.status ?? 'PENDING')}
            </span>
          </div>
          <div className="mt-4 h-2 rounded-full bg-slate-800">
            <div className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-violet-400" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-sm text-slate-300">
            {summary ? `${summary.uploadedCount} of ${summary.totalRequired} required documents uploaded.` : loading ? 'Loading requirements...' : 'No requirements found.'}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {(summary?.requiredDocuments ?? []).map((document) => (
            <button
              key={document.type}
              type="button"
              onClick={() => {
                setSelectedType(document.type);
                setSelectedFile(null);
              }}
              className={`rounded-2xl border p-4 text-left transition ${
                selectedType === document.type
                  ? 'border-cyan-300 bg-cyan-400/10'
                  : 'border-slate-700/50 bg-slate-950/50 hover:border-slate-500'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-white">{document.label}</p>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusClasses(document.status)}`}>
                  {formatStatus(document.status)}
                </span>
              </div>
              {document.rejectionReason ? (
                <p className="mt-2 text-xs text-rose-100">{document.rejectionReason}</p>
              ) : null}
            </button>
          ))}
        </div>

        <div className="rounded-3xl border border-slate-700/50 bg-slate-950/60 p-5">
          <label className="block text-sm font-semibold text-slate-100" htmlFor="kyc-camera-input">
            Camera capture
          </label>
          <p className="mt-1 text-xs text-slate-400">Only live camera image capture is accepted for KYC verification.</p>
          <input
            key={selectedType}
            id="kyc-camera-input"
            className="mt-4 block w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-slate-100 file:mr-4 file:rounded-xl file:border-0 file:bg-cyan-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
          />
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Selected KYC preview" className="mt-4 max-h-56 w-full rounded-2xl object-contain ring-1 ring-slate-700" />
          ) : null}
          <Button className="mt-4 w-full" disabled={uploading || !selectedFile || !selectedType} onClick={uploadSelectedDocument}>
            {uploading ? 'Uploading...' : 'Upload camera capture'}
          </Button>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button className="flex-1 min-w-[180px]" disabled={!summary?.canSubmit || submitting} onClick={submitForReview}>
            {submitting ? 'Submitting...' : 'Submit for review'}
          </Button>
          <Link href="/pending-approval" className="flex-1 min-w-[180px]">
            <Button className="w-full" variant="secondary" disabled={!summary?.canSubmit}>
              View review status
            </Button>
          </Link>
        </div>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => {
              logout();
              router.push('/login');
            }}
            className="text-sm text-cyan-200 hover:text-cyan-100 transition underline underline-offset-4"
          >
            Sign out to change email, phone number, or role
          </button>
        </div>
      </div>
    </AuthShell>
  );
}
