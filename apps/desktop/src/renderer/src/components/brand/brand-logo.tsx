import logoUrl from '@/assets/vetcare-logo.svg';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  showText?: boolean;
  inverted?: boolean;
}

export function BrandLogo({
  className,
  iconClassName,
  textClassName,
  showText = true,
  inverted = false,
}: BrandLogoProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <img
        src={logoUrl}
        alt="VetCare Pro"
        className={cn('size-11 shrink-0 drop-shadow-sm', iconClassName)}
        draggable={false}
      />
      {showText ? (
        <div
          className={cn(
            'font-bold tracking-[-0.03em]',
            inverted ? 'text-white' : 'text-slate-700',
            textClassName,
          )}
        >
          VetCare{' '}
          <span className={inverted ? 'text-cyan-100' : 'text-teal-600'}>
            Pro
          </span>
        </div>
      ) : null}
    </div>
  );
}
