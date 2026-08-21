/**
 * Next.js instrumentation — uses the @substrate-platform/site instrumentation factory
 * to bootstrap the feature manifest before the app handles its first request.
 *
 * Northstar overrides the service name to its own identity, proving that
 * the platform factory accepts application-specific configuration.
 */
export const register = (
  await import('@substrate-platform/site/instrumentation')
).registerInstrumentation({
  featurePreset: 'minimal',
  serviceName: 'northstar',
});
