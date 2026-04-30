import Image from 'next/image';
import { BRAND } from '@/lib/brand';

type BrandLockupProps = {
  compact?: boolean;
  showDescriptor?: boolean;
  className?: string;
};

export function BrandLockup({
  compact = false,
  showDescriptor = true,
  className = '',
}: BrandLockupProps) {
  return (
    <div
      className={[
        'flex items-center gap-4',
        compact ? 'gap-3' : 'gap-4',
        className,
      ].join(' ')}
    >
      <div className="rounded-2xl border border-cyan-300/30 bg-white px-3 py-2 shadow-lg shadow-cyan-500/10">
        <Image
          src={BRAND.assets.wordmark}
          alt={`${BRAND.appName} logo`}
          width={compact ? 96 : 128}
          height={compact ? 34 : 44}
          className="h-auto"
          priority
        />
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-cyan-300/80">
          {BRAND.companyName}
        </p>
        {showDescriptor ? (
          <p className="mt-1 text-sm text-slate-300">{BRAND.appTagline}</p>
        ) : null}
      </div>
    </div>
  );
}
