/** Initialise feature manifest with realtimeRoomFeatures preset. */
export async function register() {
  const { initFeatures, realtimeRoomFeatures } = await import('@substrate/config/features');
  initFeatures(realtimeRoomFeatures);
}
