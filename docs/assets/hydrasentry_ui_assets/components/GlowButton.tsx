import { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' };

export function GlowButton({ className, variant = 'primary', ...props }: Props) {
  return (
    <button
      className={cn(
        'inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold transition duration-200 active:scale-[.99]',
        variant === 'primary'
          ? 'bg-gradient-to-b from-white to-zinc-300 text-black shadow-[0_18px_55px_rgba(255,255,255,.16)] hover:from-white hover:to-white'
          : 'border border-white/15 bg-white/[.035] text-white hover:border-white/30 hover:bg-white/[.06]',
        className
      )}
      {...props}
    />
  );
}
