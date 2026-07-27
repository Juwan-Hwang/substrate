/**
 * Article data — re-exported from @substrate/content (single source of truth).
 *
 * The content package owns the article corpus. In production this is backed
 * by Velite/MDX collections; the reference implementation ships a static
 * corpus so routes render without a database.
 */

export type { Article } from '@substrate/content';
export { demoDocs, getArticle } from '@substrate/content';
