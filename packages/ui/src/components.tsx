/**
 * @substrate/ui — React components ported from Zephyr.
 */
import type { ReactNode, CSSProperties } from 'react';

export type PrimitiveProps = {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export type ButtonVariant = 'ghost' | 'accent' | 'danger' | 'warning' | 'success' | 'primary';

export type ButtonProps = PrimitiveProps & {
  variant?: ButtonVariant;
  disabled?: boolean;
  busy?: boolean;
  onClick?: () => void;
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
  <div className={`aevum-glass-card ${className ?? ''}`} style={style}>
    {children}
  </div>
);

const variantClass: Record<ButtonVariant, string> = {
  ghost: 'btn-ghost',
  accent: 'btn-accent',
  danger: 'btn-danger',
  warning: 'btn-warning',
  success: 'btn-success',
  primary: 'btn-primary',
};

export const Button = ({ children, className, variant = 'ghost', disabled, busy, onClick }: ButtonProps) => (
  <button
    type="button"
    className={`btn ${variantClass[variant]} ${className ?? ''}`}
    disabled={disabled}
    aria-busy={busy || undefined}
    onClick={onClick}
  >
    {children}
  </button>
);

export type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
};

export const Switch = ({ checked, onChange, className }: SwitchProps) => (
  <label className={`aevum-ios-switch ${className ?? ''}`}>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span className="aevum-switch-slider" />
  </label>
);

export type BadgeProps = PrimitiveProps & {
  variant?: 'default' | 'accent' | 'danger' | 'warning' | 'success';
};

export const Badge = ({ children, className, variant = 'default' }: BadgeProps) => (
  <span className={`aevum-badge aevum-badge-${variant} ${className ?? ''}`}>{children}</span>
);
