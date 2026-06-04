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
  const logoBoxClassName = compact
    ? 'h-16 w-full max-w-[220px] sm:h-20'
    : 'h-36 w-full max-w-[520px] sm:h-44 lg:h-48 xl:max-w-[600px]';

  return (
    <div
      className={[
        'flex flex-col',
        compact ? 'gap-2.5' : 'gap-4',
        className,
      ].join(' ')}
    >
      <div
        className={[
          'relative flex items-center overflow-hidden',
          compact ? 'justify-center lg:justify-start' : 'justify-center',
          logoBoxClassName,
        ].join(' ')}
      >
        <Image
          src={BRAND.assets.appLogo}
          alt={`${BRAND.appName} logo`}
          fill
          sizes={compact ? '(max-width: 640px) 180px, 220px' : '(max-width: 1024px) 420px, 600px'}
          className="object-contain"
          priority
        />
      </div>
      {showDescriptor ? <p className="text-sm text-slate-300">{BRAND.productLine}</p> : null}
    </div>
  );
}
