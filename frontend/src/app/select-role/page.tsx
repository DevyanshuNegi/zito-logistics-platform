import Link from 'next/link';
import { AuthShell } from '@/components/layout/AuthShell';
import { BRAND } from '@/lib/brand';
import { ROLE_PICKER_OPTIONS } from '@/lib/phase-one';

export default function SelectRolePage() {
  return (
    <AuthShell
      eyebrow="Role Selection"
      title={`Choose your ${BRAND.appName} journey`}
      subtitle="Choose the role that matches how you will work inside Zito."
      footer={
        <p>
          Already registered?{' '}
          <Link href="/login" className="text-cyan-200 hover:text-cyan-100">
            Continue to login
          </Link>
          .
        </p>
      }
    >
      <div className="grid gap-4">
        {ROLE_PICKER_OPTIONS.map((option) => (
          <Link
            key={option.role}
            href={`/register?role=${option.role}`}
            className="rounded-3xl border border-slate-700/50 bg-slate-900/55 p-5 transition hover:border-cyan-400/40 hover:bg-slate-900/80"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">{option.label}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {option.description}
                </p>
              </div>
              <span className="rounded-full border border-cyan-400/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                {option.role}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </AuthShell>
  );
}
