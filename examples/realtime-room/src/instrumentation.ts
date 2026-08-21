/** Initialise feature manifest with realtimeRoomFeatures preset. */
export const register = (
  await import('@substrate-platform/site/instrumentation')
).registerInstrumentation({
  featurePreset: 'realtime',
  serviceName: 'realtime-room',
});
