/**
 * @substrate/ui — React components ported from Zephyr.
 * Uses shadcn/ui patterns (cva + Radix Slot) for variant management.
 */

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { CSSProperties, ReactNode } from 'react';

export type PrimitiveProps = {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

// ── Button (shadcn/ui pattern: cva + Radix Slot) ───────────────────

export const buttonVariants = cva('btn', {
  variants: {
    variant: {
      ghost: 'btn-ghost',
      accent: 'btn-accent',
      danger: 'btn-danger',
      warning: 'btn-warning',
      success: 'btn-success',
      primary: 'btn-primary',
    },
    size: {
      default: '',
      sm: 'btn-sm',
      lg: 'btn-lg',
      icon: 'btn-icon',
    },
  },
  defaultVariants: {
    variant: 'ghost',
    size: 'default',
  },
});

export type ButtonProps = PrimitiveProps &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    disabled?: boolean;
    busy?: boolean;
    onClick?: () => void;
  };

/** Variant names accepted by {@link Button}. */
export type ButtonVariant = VariantProps<typeof buttonVariants>['variant'];

export const Button = ({
  children,
  className,
  variant,
  size,
  asChild = false,
  disabled,
  busy,
  onClick,
  ...props
}: ButtonProps) => {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      type={asChild ? undefined : 'button'}
      className={buttonVariants({ variant, size, className })}
      disabled={disabled}
      aria-busy={busy || undefined}
      onClick={onClick}
      {...props}
    >
      {children}
    </Comp>
  );
};

export const Box = ({ children, className, style }: PrimitiveProps) => (
  <div className={className} style={style}>
    {children}
  </div>
);

export const Stack = ({ children, className, style }: PrimitiveProps) => (
  <div className={className} style={{ display: 'flex', flexDirection: 'column', ...style }}>
    {children}
  </div>
);

export const GlassCard = ({ children, className, style }: PrimitiveProps) => (
  <div className={`substrate-glass-card ${className ?? ''}`} style={style}>
    {children}
  </div>
);

/** Props accepted by {@link GlassCard}. */
export type GlassCardProps = PrimitiveProps;

export type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
};

export const Switch = ({ checked, onChange, className }: SwitchProps) => (
  <label className={`substrate-ios-switch ${className ?? ''}`}>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span className="substrate-switch-slider" />
  </label>
);

export type BadgeProps = PrimitiveProps & {
  variant?: 'default' | 'accent' | 'danger' | 'warning' | 'success';
};

export const Badge = ({ children, className, variant = 'default' }: BadgeProps) => (
  <span className={`substrate-badge substrate-badge-${variant} ${className ?? ''}`}>
    {children}
  </span>
);
