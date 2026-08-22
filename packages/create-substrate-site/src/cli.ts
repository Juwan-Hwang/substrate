#!/usr/bin/env node
/**
 * create-substrate-site — CLI entry point.
 *
 * This is the file that `bin.create-substrate-site` points to.
 * It is executed when a consumer runs:
 *
 *   bun create-substrate-site my-site --preset minimal
 *   npx create-substrate-site my-site --channel canary
 *
 * ## Argument parsing
 *
 * Positional: <name>            Site name (kebab-case)
 *
 * Flags:
 *   --preset <name>             Feature preset (default: minimal)
 *   --content-model <name>     Content model template (default: generic)
 *   --author <name>            Site author name
 *   --url <url>                Site URL
 *   --channel <name>           Release channel: canary | latest (default: canary)
 *   --version <ver>            Pin an exact version (overrides --channel)
 *   --standalone               Generate with npm deps instead of workspace:*
 *   --help, -h                 Show help
 *
 * ## Modes
 *
 * - Inside the monorepo (detected by walking up from this script):
 *   defaults to monorepo mode (workspace:* deps) unless --standalone is passed.
 *
 * - As an installed npm package (no monorepo found):
 *   always standalone mode — writes npm version deps.
 *
 * Zero external dependencies — uses only Node.js / Bun builtins.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { argv, cwd, exit } from 'node:process';

import {
  CONTENT_MODEL_DESCRIPTIONS,
  PRESET_DESCRIPTIONS,
  PRESET_TO_MANIFEST,
  TEMPLATE_DIR,
} from './constants';
import { findMonorepoRoot, getScriptDir, resolveTemplateDir } from './fs';
import { slugify } from './helpers';
import { ask, askChannel, askContentModel, askPreset, closePrompts } from './prompts';
import { scaffoldSite } from './scaffold';
import type { Channel, CliArgs, ContentModel, Preset } from './types';

// ── CLI parsing ───────────────────────────────────────────────────

function parseArgs(args: string[]): CliArgs {
  const result: CliArgs = {};
  const positional: string[] = [];

  // Shared index for the parsing loop and next() helper.
  let i = 0;

  function next(): string {
    i++;
    const val = args[i];
    if (val === undefined) {
      console.error(`Error: missing value for "${args[i - 1]}"`);
      exit(1);
    }
    return val;
  }

  for (; i < args.length; i++) {
    const arg = args[i];
    if (arg === undefined) continue;
    if (arg === '--preset') {
      const val = next() as Preset;
      if (!PRESET_TO_MANIFEST[val]) {
        console.error(
          `Error: unknown preset "${val}". Valid: ${Object.keys(PRESET_TO_MANIFEST).join(', ')}`,
        );
        exit(1);
      }
      result.preset = val;
    } else if (arg === '--content-model') {
      const val = next() as ContentModel;
      if (!CONTENT_MODEL_DESCRIPTIONS[val]) {
        console.error(
          `Error: unknown content model "${val}". Valid: ${Object.keys(CONTENT_MODEL_DESCRIPTIONS).join(', ')}`,
        );
        exit(1);
      }
      result.contentModel = val;
    } else if (arg === '--author') {
      result.author = next();
    } else if (arg === '--url') {
      result.siteUrl = next();
    } else if (arg === '--channel') {
      const val = next() as Channel;
      if (val !== 'canary' && val !== 'latest') {
        console.error(`Error: unknown channel "${val}". Valid: canary, latest`);
        exit(1);
      }
      result.channel = val;
    } else if (arg === '--version') {
      result.version = next();
    } else if (arg === '--standalone') {
      result.standalone = true;
    } else if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }

  const firstName = positional[0];
  if (firstName) result.name = firstName;
  return result;
}

function printHelp(): void {
  const presets = Object.entries(PRESET_DESCRIPTIONS)
    .map(([key, desc]) => `  ${key.padEnd(12)} ${desc}`)
    .join('\n');

  const models = Object.entries(CONTENT_MODEL_DESCRIPTIONS)
    .map(([key, desc]) => `  ${key.padEnd(12)} ${desc}`)
    .join('\n');

  console.log(`
create-substrate-site — scaffold a new site from Substrate

Usage:
  create-substrate-site <name> [options]
  bun create-substrate-site <name> [options]
  npx create-substrate-site <name> [options]

Options:
  --preset <name>           Feature preset (see below). Default: minimal
  --content-model <name>     Content model template (see below). Default: generic
  --author <name>            Site author name
  --url <url>                Site URL (e.g. https://mysite.com)
  --channel <name>           Release channel: canary | latest. Default: canary
  --version <ver>            Pin an exact version (overrides --channel)
  --standalone               Force npm deps even inside monorepo
  --help, -h                 Show this help message

Presets:
${presets}

Content Models:
${models}

Release Channels:
  canary      Bleeding-edge — every CI build
  latest      Production-ready releases

Examples:
  create-substrate-site my-site
  create-substrate-site my-site --preset minimal --author Alice
  create-substrate-site my-site --content-model article
  create-substrate-site my-site --channel canary --url https://alice.dev
  create-substrate-site my-site --version 0.2.0
  create-substrate-site my-site --standalone
`);
}

// ── Main ───────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const scriptDir = getScriptDir(import.meta.url);
  const monorepoRoot = findMonorepoRoot(scriptDir);

  const cliArgs = parseArgs(argv.slice(2));

  if (cliArgs.help) {
    printHelp();
    exit(0);
  }

  // Determine mode: monorepo (workspace:*) or standalone (npm versions).
  const inMonorepo = monorepoRoot !== null;
  const standalone = cliArgs.standalone === true || !inMonorepo;

  // Resolve the channel — default to canary for standalone, unused for monorepo.
  const channel: Channel = cliArgs.channel ?? 'canary';

  // Resolve the template directory.
  const templateDir = resolveTemplateDir(scriptDir, TEMPLATE_DIR, monorepoRoot);

  if (!existsSync(templateDir)) {
    console.error(`Error: template directory not found: ${templateDir}`);
    console.error(
      standalone
        ? 'The northstar template should be bundled with the create-substrate-site package. If running from source, ensure examples/northstar/ exists.'
        : 'Expected to find examples/northstar/ in the monorepo.',
    );
    exit(1);
  }

  // ── Collect answers — interactive or non-interactive ───────────

  let answers: {
    name: string;
    preset: Preset;
    contentModel: ContentModel;
    author: string;
    siteUrl: string;
    channel: Channel;
    version?: string;
  };

  if (cliArgs.name && cliArgs.preset) {
    const resolved: typeof answers = {
      name: cliArgs.name,
      preset: cliArgs.preset,
      contentModel: cliArgs.contentModel ?? 'generic',
      author: cliArgs.author ?? 'Anonymous',
      siteUrl: cliArgs.siteUrl ?? `https://${slugify(cliArgs.name)}.com`,
      channel,
    };
    if (cliArgs.version) resolved.version = cliArgs.version;
    answers = resolved;
  } else {
    // Interactive mode — prompt for each field.
    console.log('\n  \x1b[1mcreate-substrate-site\x1b[0m — scaffold a new site from Substrate\n');

    try {
      const name = await ask('Site name (kebab-case)', cliArgs.name ?? 'my-site');
      const preset = await askPreset(cliArgs.preset);
      const contentModel = await askContentModel(cliArgs.contentModel);
      const author = await ask('Author name', cliArgs.author ?? 'Anonymous');
      const defaultUrl = `https://${slugify(name)}.com`;
      const siteUrl = await ask('Site URL', cliArgs.siteUrl ?? defaultUrl);

      // Only ask about channel in standalone mode.
      const resolvedChannel = standalone && !cliArgs.version ? await askChannel() : channel;

      answers = {
        name: name || 'my-site',
        preset,
        contentModel,
        author: author || 'Anonymous',
        siteUrl: siteUrl || `https://${slugify(name)}.com`,
        channel: resolvedChannel,
      };
      if (cliArgs.version) answers.version = cliArgs.version;
    } finally {
      closePrompts();
    }
  }

  const slug = slugify(answers.name);

  // Target directory:
  //   Monorepo mode  → examples/<slug>  (picked up by workspace glob)
  //   Standalone mode → <cwd>/<slug>     (independent project)
  const targetDir = standalone ? join(cwd(), slug) : join(cwd(), 'examples', slug);

  // ── Execute scaffold ───────────────────────────────────────────

  scaffoldSite({
    ...answers,
    name: slug,
    templateDir,
    targetDir,
    standalone,
  });
}

main().catch((err) => {
  console.error(err);
  exit(1);
});
