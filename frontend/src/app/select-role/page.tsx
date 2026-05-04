import Link from 'next/link';
import { AuthShell } from '@/components/layout/AuthShell';
import { getPortalConfig } from '@/lib/auth-portals';

export default function SelectRolePage() {
  const portal = getPortalConfig('service');

  return (
    <AuthShell
      eyebrow="Service Registration"
      title={`Choose your ${portal.productName} account type`}
      subtitle="This public service app is for individual customers and corporate shippers only."
      panelEyebrow={portal.panelEyebrow}
      panelTitle={portal.panelTitle}
      panelSubtitle={portal.panelSubtitle}
      footer={
        <div className="space-y-2">
          <p>
            Already registered?{' '}
            <Link href={portal.loginPath} className="text-cyan-200 hover:text-cyan-100">
              Continue to login
            </Link>
            .
          </p>
          <p>
            Driver or supply partner?{' '}
            <Link href="/partners/login" className="text-cyan-200 hover:text-cyan-100">
              Use Zito Partners
            </Link>
            .
          </p>
        </div>
      }
    >
      <div className="grid gap-4">
        {portal.roleOptions.map((option) => (
          <Link
            key={option.role}
            href={`${portal.registerPath}?role=${option.role}`}
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
