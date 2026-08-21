/**
 * Next.js instrumentation — bootstraps the feature manifest before the app
 * handles its first request. The minimal-site preset disables every backend
 * capability, leaving a pure static content site.
 */
export const register = (
  await import('@substrate-platform/site/instrumentation')
).registerInstrumentation({
  featurePreset: 'minimal',
  serviceName: 'minimal-site',
});
