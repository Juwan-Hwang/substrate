/**
 * create-substrate-site — public programmatic API.
 *
 * Import this to scaffold a Substrate site programmatically:
 *
 * ```ts
 * import { scaffoldSite, resolveSubstrateVersion } from 'create-substrate-site';
 *
 * const result = scaffoldSite({
 *   name: 'my-site',
 *   preset: 'minimal',
 *   contentModel: 'generic',
 *   author: 'Alice',
 *   siteUrl: 'https://alice.dev',
 *   channel: 'canary',
 *   templateDir: '/path/to/northstar',
 *   targetDir: '/path/to/output/my-site',
 *   standalone: true,
 * });
 * ```
 */

export {
  CONTENT_MODEL_DESCRIPTIONS,
  PLATFORM_PACKAGE_NAMES,
  PRESET_DESCRIPTIONS,
  PRESET_TO_MANIFEST,
  STABLE_VERSIONS,
  STANDALONE_INJECT_DEVDEPS,
  TEMPLATE_DIR,
} from './constants';
export {
  copyDir,
  findMonorepoRoot,
  getScriptDir,
  resolveTemplateDir,
  rewriteFile,
} from './fs';
export {
  contentHeading,
  contentNoun,
  contentSingular,
  contentTypeName,
  slugify,
  titleCase,
} from './helpers';
export { scaffoldSite } from './scaffold';
export type {
  Channel,
  CliArgs,
  ContentModel,
  Preset,
  ScaffoldAnswers,
  ScaffoldOptions,
  ScaffoldResult,
} from './types';
export {
  describeVersionSource,
  resolveSubstrateVersion,
} from './version';
