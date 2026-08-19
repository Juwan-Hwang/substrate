/** Initialise feature manifest with graphicsLabFeatures preset. */
export async function register() {
  const { initFeatures, graphicsLabFeatures } = await import('@substrate/config/features');
  initFeatures(graphicsLabFeatures);
}
