/** Initialise feature manifest with graphicsLabFeatures preset. */
export const register = (
  await import('@substrate-platform/site/instrumentation')
).registerInstrumentation({
  featurePreset: 'graphics',
  serviceName: 'graphics-lab',
});
