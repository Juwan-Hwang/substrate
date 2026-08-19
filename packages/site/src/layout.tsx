/**
 * SubstrateLayout — minimal root layout shell for a Next.js site.
 *
 * Wraps children in the standard HTML structure with font variables,
 * dark theme default, and an optional "Powered by Substrate" footer.
 *
 * The attribution is **on by default** and can be disabled via
 * `poweredBy: { enabled: false }`. The label and link are **not
 * configurable** — when shown, the attribution always reads
 * "Powered by Substrate" and always links to the official repository.
 *
 * ```tsx
 * // Default — shows "Powered by Substrate" → official GitHub.
 * <SubstrateLayout fontClass={fontVar}>{children}</SubstrateLayout>
 *
 * // Disable.
 * <SubstrateLayout poweredBy={{ enabled: false }}>
 * ```
 *
 * The footer is a platform brand default, not a licence requirement.
 * Consumers are free to disable it under Apache-2.0.
 */
import type { ReactNode } from 'react';

// ── Types ───────────────────────────────────────────────────────────

/**
 * Configuration for the "Powered by Substrate" attribution.
 *
 * `enabled` is the **only** option. The label and link URL are
 * platform constants — they cannot be overridden by consumers.
 * This ensures the attribution always serves its purpose as an
 * ecosystem entry point to the official Substrate project.
 */
export type PoweredByConfig = {
  /** Show the attribution? Defaults to `true`. */
  enabled?: boolean;
};

export type SubstrateLayoutProps = {
  children: ReactNode;
  /** CSS class containing font CSS variables (e.g. GeistSans.variable). */
  fontClass?: string;
  /** Language attribute. Defaults to 'en'. */
  lang?: string;
  /** Additional className for <html>. Defaults to 'dark'. */
  htmlClassName?: string;
  /**
   * Render the SubstrateFooter? Defaults to `true`.
   *
   * Legacy shorthand for `poweredBy: { enabled: true }`.
   */
  footer?: boolean;
  /** Configure the "Powered by Substrate" attribution. */
  poweredBy?: PoweredByConfig;
};

// ── Constants ───────────────────────────────────────────────────────

/**
 * The official Substrate repository URL.
 *
 * This is a platform constant. It is not exported and cannot be
 * overridden by consumers. When the "Powered by Substrate"
 * attribution is shown, it always links here.
 */
const SUBSTRATE_REPOSITORY = 'https://github.com/Juwan-Hwang/substrate';

// ── Components ──────────────────────────────────────────────────────

export function SubstrateLayout({
  children,
  fontClass = '',
  lang = 'en',
  htmlClassName = 'dark',
  footer = true,
  poweredBy,
}: SubstrateLayoutProps) {
  // `poweredBy` takes precedence over legacy `footer` prop.
  const enabled = poweredBy?.enabled ?? footer;

  return (
    <html lang={lang} className={`${htmlClassName} ${fontClass}`.trim()} suppressHydrationWarning>
      <body>
        {children}
        <SubstrateFooter enabled={enabled} />
      </body>
    </html>
  );
}

/**
 * SubstrateFooter — renders the "Powered by Substrate" attribution.
 *
 * **On by default.** This is a platform brand default, not a licence
 * requirement. Under Apache-2.0, consumers are free to disable it:
 *
 * ```tsx
 * // Disable
 * <SubstrateFooter enabled={false} />
 *
 * // Or via layout
 * <SubstrateLayout poweredBy={{ enabled: false }}>
 * ```
 *
 * The label is always "Powered by Substrate" and the link always
 * points to the official Substrate repository. Neither is
 * configurable — see `PoweredByConfig`.
 */
export function SubstrateFooter({ enabled = true }: { enabled?: boolean } = {}) {
  if (!enabled) return null;

  return (
    <footer className="mx-auto max-w-5xl px-6 pb-8 pt-4 text-center">
      <p className="text-xs" style={{ color: 'var(--substrate-text-tertiary)', opacity: 0.6 }}>
        Powered by{' '}
        <a
          href={SUBSTRATE_REPOSITORY}
          target="_blank"
          rel="noopener noreferrer"
          className="underline transition-opacity hover:opacity-80"
        >
          Substrate
        </a>
      </p>
    </footer>
  );
}
