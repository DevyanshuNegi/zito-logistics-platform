'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ApiError, api } from '@/lib/api';
import { formatDateTime, formatMoney, formatStatus } from '@/lib/format';

type VerificationPricing = {
  standardMode: {
    processingTime: string;
    cost: number;
    badge: string;
  };
  expeditedMode: {
    processingTime: string;
    cost: number;
    costFormatted?: string;
    badge: string;
  };
};

type VerificationStatus = {
  overallStatus: string;
  kycDocuments: Array<{ id: string; type: string; status: string }>;
  expeditedPayment?: {
    id: string;
    status: string;
    amount: number;
    paidAt?: string | null;
    expectedCompletion?: string | null;
  } | null;
  certificate?: {
    number: string;
    issuedAt?: string | null;
    expiresAt?: string | null;
  } | null;
};

type VerificationExpeditePanelProps = {
  enabled?: boolean;
  compact?: boolean;
};

export function VerificationExpeditePanel({
  enabled = true,
  compact = false,
}: VerificationExpeditePanelProps) {
  const [pricing, setPricing] = useState<VerificationPricing | null>(null);
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(enabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadVerification = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [pricingResponse, statusResponse] = await Promise.all([
        api.get<VerificationPricing>('/verification/pricing'),
        api.get<VerificationStatus>('/verification/status'),
      ]);
      setPricing(pricingResponse);
      setStatus(statusResponse);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load verification status.');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void loadVerification();
  }, [loadVerification]);

  const pendingDocs = useMemo(
    () =>
      (status?.kycDocuments ?? []).filter((document) =>
        ['PENDING', 'UNDER_REVIEW'].includes(document.status.toUpperCase()),
      ),
    [status],
  );
  const alreadyExpedited = Boolean(status?.expeditedPayment);
  const isVerified = ['VERIFIED', 'APPROVED', 'ACTIVE'].includes(
    String(status?.overallStatus ?? '').toUpperCase(),
  );
  const canExpedite = enabled && pendingDocs.length > 0 && !alreadyExpedited && !isVerified;

  async function handleExpedite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canExpedite || saving) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await api.post<{ expectedCompletionDate?: string | null }>(
        '/verification/expedite',
        { reason: reason.trim() || undefined },
      );
      setSuccess(
        response.expectedCompletionDate
          ? `Expedited verification requested. Expected completion: ${formatDateTime(response.expectedCompletionDate)}.`
          : 'Expedited verification requested.',
      );
      setReason('');
      await loadVerification();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to request expedited verification.',
      );
    } finally {
      setSaving(false);
    }
  }

  const shellClass = compact
    ? 'rounded-3xl border border-slate-700/40 bg-slate-900/55 p-5'
    : 'rounded-[22px] border border-[#d7e0ec] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)]';
  const mutedText = compact ? 'text-slate-300' : 'text-[#64748b]';
  const titleText = compact ? 'text-white' : 'text-[#1a1a2e]';
  const chipClass = compact
    ? 'bg-cyan-400/15 text-cyan-100'
    : 'bg-[#eef4ff] text-[#1b3f72]';

  return (
    <section className={shellClass}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${mutedText}`}>
            Verification
          </p>
          <h2 className={`mt-1 text-lg font-semibold ${titleText}`}>
            Expedited review
          </h2>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${chipClass}`}>
          <ShieldCheck className="h-5 w-5" />
        </div>
      </div>

      {!enabled ? (
        <p className={`mt-3 text-sm leading-6 ${mutedText}`}>
          Sign in after registration approval to request paid expedited verification.
        </p>
      ) : loading ? (
        <p className={`mt-3 text-sm leading-6 ${mutedText}`}>Loading verification status...</p>
      ) : (
        <>
          <div className={`mt-4 rounded-2xl ${compact ? 'bg-slate-950/55' : 'bg-[#f8faff]'} px-4 py-3`}>
            <p className={`text-sm font-semibold ${titleText}`}>
              Status: {formatStatus(status?.overallStatus ?? 'Pending')}
            </p>
            <p className={`mt-1 text-xs leading-5 ${mutedText}`}>
              Standard review: {pricing?.standardMode.processingTime ?? '7-10 business days'}.
              Expedited review: {pricing?.expeditedMode.processingTime ?? '24 hours'} for{' '}
              {formatMoney(pricing?.expeditedMode.cost ?? 500)}.
            </p>
            {status?.expeditedPayment ? (
              <p className={`mt-2 text-xs font-semibold ${mutedText}`}>
                Expedited payment: {formatStatus(status.expeditedPayment.status)}
                {status.expeditedPayment.expectedCompletion
                  ? `, ETA ${formatDateTime(status.expeditedPayment.expectedCompletion)}`
                  : ''}
              </p>
            ) : null}
            {status?.certificate ? (
              <p className={`mt-2 text-xs font-semibold ${mutedText}`}>
                Certificate: {status.certificate.number}
              </p>
            ) : null}
          </div>

          {error ? (
            <div className="mt-4">
              <Alert title="Verification issue" variant="danger">
                {error}
              </Alert>
            </div>
          ) : null}
          {success ? (
            <div className="mt-4">
              <Alert title="Verification request sent" variant="success">
                {success}
              </Alert>
            </div>
          ) : null}

          <form className="mt-4 grid gap-3" onSubmit={handleExpedite}>
            <Input
              label="Reason"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setError(null);
                setSuccess(null);
              }}
              placeholder="Example: Need activation for dispatch this week"
              disabled={!canExpedite || saving}
              tone={compact ? 'dark' : 'light'}
            />
            <Button type="submit" disabled={!canExpedite || saving}>
              {saving ? 'Requesting...' : 'Pay and expedite verification'}
            </Button>
          </form>

          {!canExpedite ? (
            <p className={`mt-3 text-xs leading-5 ${mutedText}`}>
              {isVerified
                ? 'This profile is already verified.'
                : alreadyExpedited
                  ? 'Expedited review has already been requested.'
                  : 'Submit pending KYC documents before requesting expedited review.'}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
