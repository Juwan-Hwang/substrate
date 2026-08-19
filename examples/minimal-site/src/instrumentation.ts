/**
 * Next.js instrumentation — bootstraps the feature manifest before the app
 * handles its first request. The minimal-site preset disables every backend
 * capability, leaving a pure static content site.
 */
export async function register(): Promise<void> {
  const { initFeatures, minimalSiteFeatures } = await import('@substrate/config/features');
  initFeatures(minimalSiteFeatures);
}
