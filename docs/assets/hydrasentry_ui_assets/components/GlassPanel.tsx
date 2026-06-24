import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function GlassPanel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-white/10 bg-white/[.045] shadow-[0_24px_90px_rgba(0,0,0,.55)] backdrop-blur-xl',
        'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/10',
        'relative overflow-hidden',
        className
      )}
      {...props}
    />
  );
}
