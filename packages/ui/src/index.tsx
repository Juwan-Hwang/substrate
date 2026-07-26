/**
 * @substrate/ui — Component library for Aevum.
 *
 * Primitives shared across Lattice, Crucible, and Archive subsystems.
 */

export type PrimitiveProps = {
  children?: React.ReactNode;
  className?: string;
};

export const Box = ({ children, className }: PrimitiveProps) => (
  <div className={className}>{children}</div>
);

export const Stack = ({ children, className }: PrimitiveProps) => (
  <div className={className} style={{ display: 'flex', flexDirection: 'column' }}>
    {children}
  </div>
);
