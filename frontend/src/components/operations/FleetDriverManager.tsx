'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PhoneContactField } from '@/components/ui/PhoneContactField';
import { Spinner } from '@/components/ui/Spinner';
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
  vehicle?: {
    id: string;
    plateNumber?: string | null;
    type?: string | null;
    status?: string | null;
  } | null;
};

type VehicleOption = {
  id: string;
  plateNumber: string;
  type?: string | null;
  status?: string | null;
  driver?: {
    id?: string | null;
    user?: {
      fullName?: string | null;
    } | null;
  } | null;
};

type OnboardDriverResponse = {
  data: {
    temporaryPassword?: string | null;
  };
};

type FleetDriverManagerProps = {
  title: string;
  description: string;
  ownerLabel: string;
  vehicles: VehicleOption[];
  tone?: 'dark' | 'light';
  refreshToken?: number;
  onChange?: () => void | Promise<void>;
};

function getToneClasses(tone: 'dark' | 'light') {
  if (tone === 'light') {
    return {
      card: 'rounded-[24px] border border-[#d7e0ec] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]',
      mutedCard: 'rounded-[18px] border border-[#e2e8f0] bg-[#f8fbff] p-4',
      statCard: 'rounded-[18px] border border-[#d7e0ec] bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)]',
      label: 'text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]',
      heading: 'text-lg font-semibold text-[#1a1a2e]',
      copy: 'text-sm leading-6 text-[#64748b]',
      title: 'text-sm font-semibold text-[#1a1a2e]',
      body: 'text-xs leading-5 text-[#64748b]',
      value: 'text-2xl font-semibold text-[#1a1a2e]',
      select:
        'w-full rounded-[14px] border border-[#d7e0ec] bg-white px-3 py-2 text-sm text-[#1a1a2e] focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100',
      badge:
        'inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold',
      online: 'bg-[#dcfce7] text-[#15803d]',
      offline: 'bg-[#eef2f7] text-[#64748b]',
    };
  }

  return {
    card: 'rounded-3xl border border-slate-700/40 bg-slate-950/55 p-5 shadow-2xl backdrop-blur',
    mutedCard: 'rounded-3xl border border-slate-700/40 bg-slate-900/55 p-4',
    statCard: 'rounded-3xl border border-slate-700/40 bg-slate-950/55 p-4 shadow-2xl backdrop-blur',
    label: 'text-xs uppercase tracking-[0.24em] text-slate-400',
    heading: 'text-lg font-semibold text-white',
    copy: 'text-sm text-slate-400',
    title: 'text-sm font-semibold text-white',
    body: 'text-xs leading-5 text-slate-400',
    value: 'text-3xl font-semibold text-white',
    select:
      'w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none',
    badge:
      'inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold',
    online: 'bg-emerald-500/15 text-emerald-200',
    offline: 'bg-slate-800/70 text-slate-300',
  };
}

export function FleetDriverManager({
  title,
  description,
  ownerLabel,
  vehicles,
  tone = 'dark',
  refreshToken = 0,
  onChange,
}: FleetDriverManagerProps) {
  const classes = getToneClasses(tone);
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [loadedVehicles, setLoadedVehicles] = useState<VehicleOption[]>(vehicles);
  const [fullName, setFullName] = useState('');
  const [countryOptionCode, setCountryOptionCode] = useState(DEFAULT_COUNTRY_ISO_CODE);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assigningDriverId, setAssigningDriverId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [creationFeedback, setCreationFeedback] = useState<{
    variant: 'success' | 'danger';
    title: string;
    message: string;
  } | null>(null);
  const fullNameRef = useRef<HTMLInputElement | null>(null);

  const activeDriverCount = useMemo(
    () => drivers.filter((driver) => driver.user?.status === 'ACTIVE').length,
    [drivers],
  );
  const availableDriverCount = useMemo(
    () => drivers.filter((driver) => driver.isAvailable).length,
    [drivers],
  );
  const assignedVehicleCount = useMemo(
    () => drivers.filter((driver) => Boolean(driver.vehicle?.id)).length,
    [drivers],
  );
  const effectiveVehicles = vehicles.length > 0 ? vehicles : loadedVehicles;
  const selectedCountryOption = useMemo(
    () => findCountryCodeOptionByIsoCode(countryOptionCode),
    [countryOptionCode],
  );

  async function loadVehicles() {
    try {
      const response = await api.get<VehicleOption[]>('/fleet');
      setLoadedVehicles(response);
    } catch {
      setLoadedVehicles([]);
    }
  }

  async function loadDrivers() {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<DriverRow[]>('/drivers');
      setDrivers(response);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to load managed drivers.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.all([loadDrivers(), loadVehicles()]);
  }, [refreshToken]);

  useEffect(() => {
    setLoadedVehicles(vehicles);
  }, [vehicles]);

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
      setSuccess(
        'Driver onboarding draft created. The driver uses the Driver app after activation.',
      );
      setCreationFeedback({
        variant: 'success',
        title: 'Registration successful',
        message:
          'Driver onboarding draft created successfully. You can create another driver now or continue with vehicle assignment.',
      });
      setFullName('');
      setCountryOptionCode(DEFAULT_COUNTRY_ISO_CODE);
      setPhoneNumber('');
      setEmail('');
      setLicenseNumber('');
      setLicenseExpiry('');
      await loadDrivers();
      await onChange?.();
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

  async function handleAssignmentChange(driver: DriverRow, nextVehicleId: string) {
    const currentVehicleId = driver.vehicle?.id ?? '';
    if (currentVehicleId === nextVehicleId) {
      return;
    }

    setAssigningDriverId(driver.id);
    setError(null);
    setSuccess(null);

    try {
      if (currentVehicleId) {
        await api.patch(`/fleet/${currentVehicleId}`, { driverId: null });
      }

      if (nextVehicleId) {
        await api.patch(`/fleet/${nextVehicleId}/assign-driver`, {
          driverId: driver.id,
        });
      }

      setSuccess(
        nextVehicleId
          ? 'Driver assignment updated for the selected fleet vehicle.'
          : 'Driver removed from the previous vehicle assignment.',
      );
      await Promise.all([loadDrivers(), loadVehicles()]);
      await onChange?.();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to update the vehicle assignment.',
      );
    } finally {
      setAssigningDriverId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className={classes.statCard}>
          <p className={classes.label}>Managed drivers</p>
          <p className={`mt-3 ${classes.value}`}>{drivers.length}</p>
          <p className={`mt-2 ${classes.body}`}>All drivers linked to this {ownerLabel}.</p>
        </div>
        <div className={classes.statCard}>
          <p className={classes.label}>Active accounts</p>
          <p className={`mt-3 ${classes.value}`}>{activeDriverCount}</p>
          <p className={`mt-2 ${classes.body}`}>
            Drivers already active and ready to sign in to the driver app.
          </p>
        </div>
        <div className={classes.statCard}>
          <p className={classes.label}>Vehicle links</p>
          <p className={`mt-3 ${classes.value}`}>{assignedVehicleCount}</p>
          <p className={`mt-2 ${classes.body}`}>
            {availableDriverCount} available drivers can still be matched to vehicles.
          </p>
        </div>
      </div>

      <Alert title="Driver app access" variant="info">
        Fleet-managed drivers still sign in through the dedicated driver app. Fleet owners only manage roster ownership, readiness, and vehicle assignment.
      </Alert>

      {error ? (
        <Alert title="Fleet driver management error" variant="danger">
          {error}
        </Alert>
      ) : null}

      {success ? (
        <Alert title="Fleet driver update" variant="success">
          {success}
          {temporaryPassword ? ` Temporary password: ${temporaryPassword}` : ''}
        </Alert>
      ) : null}

      <section className={classes.card}>
        <div className="mb-5">
          <p className={classes.label}>Driver roster</p>
          <h3 className={`mt-1 ${classes.heading}`}>{title}</h3>
          <p className={`mt-2 ${classes.copy}`}>{description}</p>
        </div>

        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={handleSubmit}>
          <Input
            label="Full name"
            tone={tone === 'light' ? 'light' : 'dark'}
            ref={fullNameRef}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
          />
          <div className="md:col-span-2 xl:col-span-2">
            <PhoneContactField
              required
              tone={tone === 'light' ? 'light' : 'dark'}
              countryOptionCode={countryOptionCode}
              phoneNumber={phoneNumber}
              onCountryChange={setCountryOptionCode}
              onPhoneChange={(value) => setPhoneNumber(normalizePhoneNumber(value))}
            />
          </div>
          <Input
            label="Email"
            tone={tone === 'light' ? 'light' : 'dark'}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            label="License number"
            tone={tone === 'light' ? 'light' : 'dark'}
            value={licenseNumber}
            onChange={(event) => setLicenseNumber(event.target.value)}
          />
          <Input
            label="License expiry"
            tone={tone === 'light' ? 'light' : 'dark'}
            type="date"
            value={licenseExpiry}
            onChange={(event) => setLicenseExpiry(event.target.value)}
          />
          <div className="space-y-3 md:col-span-2 xl:col-span-2">
            {creationFeedback ? (
              <Alert title={creationFeedback.title} variant={creationFeedback.variant}>
                {creationFeedback.message}
                {temporaryPassword ? ` Temporary password: ${temporaryPassword}` : ''}
              </Alert>
            ) : null}
            <div className="flex flex-wrap items-end gap-3">
              <Button className="w-full sm:w-auto" disabled={saving} type="submit">
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
      </section>

      <section className={classes.card}>
        <div className="mb-5">
          <p className={classes.label}>Live roster</p>
          <h3 className={`mt-1 ${classes.heading}`}>Managed driver cards</h3>
          <p className={`mt-2 ${classes.copy}`}>
            Assign a managed driver to a vehicle from the same owned fleet. Each driver can hold only one live vehicle assignment at a time.
          </p>
        </div>

        {loading ? (
          <Spinner />
        ) : drivers.length === 0 ? (
          <div className={classes.mutedCard}>
            <p className={classes.title}>No drivers yet</p>
            <p className={`mt-2 ${classes.body}`}>
              Add your first driver above. The roster will appear here with activation status, license details, and vehicle assignment.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {drivers.map((driver) => {
              const vehicleOptions = effectiveVehicles.filter(
                (vehicle) => !vehicle.driver?.id || vehicle.driver.id === driver.id,
              );

              return (
                <div key={driver.id} className={classes.mutedCard}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={classes.title}>
                          {driver.user?.fullName ?? 'Unnamed driver'}
                        </p>
                        <span className={`${classes.badge} ${classes.online}`}>
                          {formatStatus(driver.user?.status ?? 'PENDING')}
                        </span>
                        <span
                          className={`${classes.badge} ${
                            driver.isOnline ? classes.online : classes.offline
                          }`}
                        >
                          {driver.isOnline ? 'Online' : 'Offline'}
                        </span>
                        <span
                          className={`${classes.badge} ${
                            driver.isAvailable ? classes.online : classes.offline
                          }`}
                        >
                          {driver.isAvailable ? 'Available' : 'Unavailable'}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div>
                          <p className={classes.label}>Phone</p>
                          <p className={`mt-1 ${classes.body}`}>
                            {driver.user?.phone ?? 'Phone pending'}
                          </p>
                        </div>
                        <div>
                          <p className={classes.label}>Email</p>
                          <p className={`mt-1 ${classes.body}`}>
                            {driver.user?.email ?? 'No email'}
                          </p>
                        </div>
                        <div>
                          <p className={classes.label}>License</p>
                          <p className={`mt-1 ${classes.body}`}>
                            {driver.licenseNumber ?? 'Not captured'}
                          </p>
                        </div>
                        <div>
                          <p className={classes.label}>Expiry</p>
                          <p className={`mt-1 ${classes.body}`}>
                            {driver.licenseExpiry
                              ? formatDateTime(driver.licenseExpiry)
                              : 'Pending'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="w-full rounded-[18px] border border-black/5 bg-white/5 p-3 lg:max-w-[260px]">
                      <p className={classes.label}>Assigned vehicle</p>
                      <p className={`mt-1 ${classes.body}`}>
                        {driver.vehicle?.plateNumber
                          ? `${driver.vehicle.plateNumber} · ${driver.vehicle.type ?? 'Vehicle'}`
                          : 'No vehicle assigned'}
                      </p>
                      <select
                        className={`mt-3 ${classes.select}`}
                        value={driver.vehicle?.id ?? ''}
                        onChange={(event) => {
                          void handleAssignmentChange(driver, event.target.value);
                        }}
                        disabled={assigningDriverId === driver.id}
                      >
                        <option value="">Keep unassigned</option>
                        {vehicleOptions.map((vehicle) => (
                          <option key={vehicle.id} value={vehicle.id}>
                            {vehicle.plateNumber}
                            {vehicle.type ? ` · ${vehicle.type}` : ''}
                          </option>
                        ))}
                      </select>
                      {assigningDriverId === driver.id ? (
                        <p className={`mt-2 ${classes.body}`}>Updating assignment...</p>
                      ) : null}
                    </div>
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
