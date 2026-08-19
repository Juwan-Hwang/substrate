/**
 * @substrate/config — Shared configuration: feature manifest, tsconfig, biome.
 */

export type { FeatureManifest } from './features';
export {
  aiArchiveFeatures,
  featureManifestSchema,
  features,
  graphicsLabFeatures,
  initFeatures,
  isEnabled,
  minimalSiteFeatures,
  realtimeRoomFeatures,
  referenceFeatures,
  validateEnv,
} from './features';
