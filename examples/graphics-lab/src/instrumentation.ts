/** Initialise feature manifest with graphicsLabFeatures preset. */
export const register = (await import('@substrate/site/instrumentation')).registerInstrumentation({
  featurePreset: 'graphics',
  serviceName: 'graphics-lab',
});
