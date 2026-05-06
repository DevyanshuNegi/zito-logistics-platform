'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PhoneContactField } from '@/components/ui/PhoneContactField';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { ApiError, api } from '@/lib/api';
import { buildPhoneContact, normalizePhoneNumber } from '@/lib/auth-login';
import {
  DEFAULT_COUNTRY_ISO_CODE,
  findCountryCodeOptionByIsoCode,
} from '@/lib/country-codes';
import { formatDateTime, formatStatus } from '@/lib/format';

type DriverRow = {
  id: string;
  licenseNumber?: string | null;
  licenseExpiry?: string | null;
  isAvailable?: boolean;
  isOnline?: boolean;
  user?: {
    id: string;
    fullName?: string | null;
    phone?: string | null;
    email?: string | null;
    status?: string | null;
  } | null;
};

type OnboardDriverResponse = {
  data: {
    temporaryPassword?: string | null;
  };
};

export default function AgentDriversPage() {
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [fullName, setFullName] = useState('');
  const [countryOptionCode, setCountryOptionCode] = useState(DEFAULT_COUNTRY_ISO_CODE);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [creationFeedback, setCreationFeedback] = useState<{
    variant: 'success' | 'danger';
    title: string;
    message: string;
  } | null>(null);
  const fullNameRef = useRef<HTMLInputElement | null>(null);
  const selectedCountryOption = useMemo(
    () => findCountryCodeOptionByIsoCode(countryOptionCode),
    [countryOptionCode],
  );

  async function loadDrivers() {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<DriverRow[]>('/drivers');
      setDrivers(response);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load agent drivers.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDrivers();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    setTemporaryPassword(null);
    setCreationFeedback(null);

    try {
      const response = await api.post<OnboardDriverResponse>('/drivers/onboard', {
        fullName,
        phone: buildPhoneContact(
          selectedCountryOption?.dialCode ?? '+254',
          phoneNumber,
        ),
        email: email.trim() || undefined,
        licenseNumber: licenseNumber.trim() || undefined,
        licenseExpiry: licenseExpiry || undefined,
      });

      setTemporaryPassword(response.data.temporaryPassword ?? null);
      setSuccess('Driver onboarding draft created. Admin activation can follow later.');
      setCreationFeedback({
        variant: 'success',
        title: 'Registration successful',
        message:
          'Driver onboarding draft created successfully. You can create another driver now or review the roster below.',
      });
      setFullName('');
      setCountryOptionCode(DEFAULT_COUNTRY_ISO_CODE);
      setPhoneNumber('');
      setEmail('');
      setLicenseNumber('');
      setLicenseExpiry('');
      await loadDrivers();
    } catch (caught) {
      const message = caught instanceof ApiError ? caught.message : 'Unable to onboard driver.';
      setError(message);
      setCreationFeedback({
        variant: 'danger',
        title: 'Registration failed',
        message,
      });
    } finally {
      setSaving(false);
    }
  }

  function handleCreateAnother() {
    setCreationFeedback(null);
    setTemporaryPassword(null);
    setFullName('');
    setCountryOptionCode(DEFAULT_COUNTRY_ISO_CODE);
    setPhoneNumber('');
    setEmail('');
    setLicenseNumber('');
    setLicenseExpiry('');
    window.requestAnimationFrame(() => {
      fullNameRef.current?.focus();
    });
  }

  const pendingDrivers = drivers.filter((driver) => driver.user?.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Drivers" value={String(drivers.length)} helper="Drivers attached to this agent network." />
        <StatCard label="Available" value={String(drivers.filter((driver) => driver.isAvailable).length)} helper="Drivers ready for allocation." tone="success" />
        <StatCard label="Pending activation" value={String(pendingDrivers)} helper="Driver accounts waiting for final activation." tone="warning" />
      </div>

      {error ? (
        <Alert title="Agent drivers error" variant="danger">
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert title="Driver onboarding created" variant="success">
          {success}
          {temporaryPassword ? ` Temporary password: ${temporaryPassword}` : ''}
        </Alert>
      ) : null}

      <SurfaceCard title="Onboard driver" description="Create a managed driver account under the agent network. The driver record starts pending activation and can be assigned to vehicles immediately.">
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={handleSubmit}>
          <Input label="Full name" ref={fullNameRef} value={fullName} onChange={(event) => setFullName(event.target.value)} required />
          <div className="md:col-span-2 xl:col-span-2">
            <PhoneContactField
              required
              countryOptionCode={countryOptionCode}
              phoneNumber={phoneNumber}
              onCountryChange={setCountryOptionCode}
              onPhoneChange={(value) => setPhoneNumber(normalizePhoneNumber(value))}
            />
          </div>
          <Input label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <Input label="License number" value={licenseNumber} onChange={(event) => setLicenseNumber(event.target.value)} />
          <Input label="License expiry" type="date" value={licenseExpiry} onChange={(event) => setLicenseExpiry(event.target.value)} />
          <div className="space-y-3 md:col-span-2 xl:col-span-4">
            {creationFeedback ? (
              <Alert title={creationFeedback.title} variant={creationFeedback.variant}>
                {creationFeedback.message}
                {temporaryPassword ? ` Temporary password: ${temporaryPassword}` : ''}
              </Alert>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <Button disabled={saving} type="submit">
                {saving ? 'Saving driver...' : 'Create driver'}
              </Button>
              {creationFeedback?.variant === 'success' ? (
                <Button type="button" variant="ghost" onClick={handleCreateAnother}>
                  Create another
                </Button>
              ) : null}
            </div>
          </div>
        </form>
      </SurfaceCard>

      <SurfaceCard title="Driver roster" description="Managed drivers, activation state, and readiness visibility.">
        {loading ? (
          <Spinner />
        ) : (
          <Table
            rows={drivers}
            columns={[
              {
                key: 'driver',
                header: 'Driver',
                render: (driver) => (
                  <div>
                    <p className="font-semibold text-white">{driver.user?.fullName ?? 'Unnamed driver'}</p>
                    <p className="text-xs text-slate-400">{driver.user?.phone ?? 'Phone pending'}</p>
                  </div>
                ),
              },
              {
                key: 'account',
                header: 'Account',
                render: (driver) => (
                  <div className="text-xs text-slate-300">
                    <p>{formatStatus(driver.user?.status ?? 'PENDING')}</p>
                    <p>{driver.user?.email ?? 'No email'}</p>
                  </div>
                ),
              },
              {
                key: 'license',
                header: 'License',
                render: (driver) => (
                  <div className="text-xs text-slate-300">
                    <p>{driver.licenseNumber ?? 'Not captured'}</p>
                    <p>{driver.licenseExpiry ? formatDateTime(driver.licenseExpiry) : 'Expiry pending'}</p>
                  </div>
                ),
              },
              {
                key: 'readiness',
                header: 'Readiness',
                render: (driver) => (
                  <div className="text-xs text-slate-300">
                    <p>{driver.isOnline ? 'Online' : 'Offline'}</p>
                    <p>{driver.isAvailable ? 'Available' : 'Unavailable'}</p>
                  </div>
                ),
              },
            ]}
          />
        )}
      </SurfaceCard>
    </div>
  );
}
