/**
 * @substrate/config — Shared configuration: feature manifest, tsconfig, biome.
 */
export {
  featureManifestSchema,
  minimalSiteFeatures,
  graphicsLabFeatures,
  aiArchiveFeatures,
  realtimeRoomFeatures,
  fullPlatformFeatures,
  initFeatures,
  features,
  isEnabled,
  validateEnv,
} from './features';
export type { FeatureManifest } from './features';
