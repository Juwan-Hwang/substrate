/**
 * ThemeScript — injects the theme class before hydration to prevent
 * flash-of-incorrect-theme (FOIT).
 *
 * Place this inside <head> in your root layout:
 *
 * ```tsx
 * <head>
 *   <ThemeScript />
 * </head>
 * ```
 *
 * Reads the `theme` value from localStorage. Defaults to `dark` if
 * no preference is stored. No application-specific logic — the theme
 * token name and default are configurable via props.
 */
import type { ReactElement } from 'react';

export function ThemeScript(options?: {
  /** CSS custom property or class name prefix. */
  attribute?: 'class' | 'data-theme';
  /** Default theme when no localStorage entry exists. */
  defaultTheme?: string;
  /** localStorage key. */
  storageKey?: string;
}): ReactElement {
  const { attribute = 'class', defaultTheme = 'dark', storageKey = 'theme' } = options ?? {};

  const script = `(function(){try{var t=localStorage.getItem('${storageKey}')||'${defaultTheme}';document.documentElement.setAttribute('${attribute}',t)}catch(e){document.documentElement.setAttribute('${attribute}','${defaultTheme}')}})()`;

  return (
    <script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: static string, no user input
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
