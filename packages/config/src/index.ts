/**
 * @substrate/config — Shared configuration: feature manifest, tsconfig, biome.
 */

export type { FeatureManifest } from './features';
export {
  aiArchiveFeatures,
  featureManifestSchema,
  features,
  fullPlatformFeatures,
  graphicsLabFeatures,
  initFeatures,
  isEnabled,
  minimalSiteFeatures,
  realtimeRoomFeatures,
  validateEnv,
} from './features';
