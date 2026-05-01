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
      <Image
        src={BRAND.assets.appLogo}
        alt={`${BRAND.appName} logo`}
        width={compact ? 220 : 320}
        height={compact ? 84 : 122}
        className="h-auto w-auto max-w-full"
        priority
      />
      {showDescriptor ? <p className="text-sm text-slate-300">{BRAND.productLine}</p> : null}
    </div>
  );
}
