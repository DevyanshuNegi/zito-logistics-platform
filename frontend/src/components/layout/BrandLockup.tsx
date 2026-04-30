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
        'flex flex-col items-start',
        compact ? 'gap-2.5' : 'gap-4',
        className,
      ].join(' ')}
    >
      <div className={['flex items-center', compact ? 'gap-2.5' : 'gap-3'].join(' ')}>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/30 bg-slate-950/90 p-2 shadow-lg shadow-cyan-500/10">
          <Image
            src={BRAND.assets.appIcon}
            alt={`${BRAND.appName} app icon`}
            width={compact ? 30 : 34}
            height={compact ? 30 : 34}
            className="h-auto w-auto"
            priority
          />
        </div>
        <div className="rounded-2xl border border-cyan-300/30 bg-white px-3 py-2 shadow-lg shadow-cyan-500/10">
          <Image
            src={BRAND.assets.appWordmark}
            alt={`${BRAND.appName} wordmark`}
            width={compact ? 92 : 124}
            height={compact ? 30 : 40}
            className="h-auto"
            priority
          />
        </div>
      </div>
      {!compact ? (
        <div className="w-[15rem] overflow-hidden rounded-2xl border border-white/10 bg-white/95 px-3 py-2.5 shadow-lg shadow-slate-950/20">
          <Image
            src={BRAND.assets.companyLogo}
            alt={`${BRAND.companyName} company logo`}
            width={216}
            height={128}
            className="h-auto w-full"
            priority
          />
        </div>
      ) : null}
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
