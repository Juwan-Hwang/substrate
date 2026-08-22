/**
 * create-substrate-site — interactive prompts.
 *
 * Uses Node's standard readline/promises API for cross-platform
 * interactive input. Works identically under npx, npm exec, bun,
 * PowerShell, Linux terminals, and GitHub Actions.
 *
 * Zero external dependencies — uses only node:readline/promises.
 */

import { stdin as input, stdout as output } from 'node:process';
import { createInterface, type Interface } from 'node:readline/promises';

import { CONTENT_MODEL_DESCRIPTIONS, PRESET_DESCRIPTIONS } from './constants';
import type { ContentModel, Preset } from './types';

// ── readline lifecycle ─────────────────────────────────────────────

let rl: Interface | null = null;

/**
 * Lazily create the readline interface on first prompt.
 * Reused across all subsequent prompts, then closed via {@link closePrompts}.
 */
function getReadline(): Interface {
  if (rl === null) {
    rl = createInterface({ input, output, terminal: false });
  }
  return rl;
}

/**
 * Close the readline interface. Should be called after all prompts
 * are done, before the process exits.
 */
export function closePrompts(): void {
  if (rl !== null) {
    rl.close();
    rl = null;
  }
}

// ── Prompt primitive ──────────────────────────────────────────────

/**
 * Read a line from stdin via node:readline/promises.
 * Standard cross-platform CLI stdin/stdout — no file-descriptor hacks.
 */
export async function ask(question: string, defaultValue?: string): Promise<string> {
  const suffix = defaultValue ? ` (${defaultValue})` : '';
  const promptText = `${question}${suffix}: `;
  const answer = await getReadline().question(promptText);
  return answer.trim() || defaultValue || '';
}

// ── Preset selector ───────────────────────────────────────────────

/**
 * Interactive preset selector — displays a numbered menu and returns
 * the chosen preset. Falls back to text input if the number is invalid.
 */
export async function askPreset(defaultPreset?: Preset): Promise<Preset> {
  const entries = Object.entries(PRESET_DESCRIPTIONS) as [Preset, string][];
  console.log('\n  Feature presets:\n');
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i] ?? entries[0];
    if (!entry) continue;
    const [key, desc] = entry;
    const marker = key === defaultPreset ? ' (default)' : '';
    console.log(`    \x1b[36m${i + 1}\x1b[0m. ${key.padEnd(12)} ${desc}${marker}`);
  }
  console.log('');

  const input = await ask('Choose preset (1-5)', defaultPreset ?? 'minimal');
  const num = Number(input);
  if (Number.isInteger(num) && num >= 1 && num <= entries.length) {
    return entries[num - 1]?.[0] ?? defaultPreset ?? 'minimal';
  }
  if (PRESET_DESCRIPTIONS[input as Preset]) {
    return input as Preset;
  }
  return defaultPreset ?? 'minimal';
}

// ── Content model selector ────────────────────────────────────────

/**
 * Interactive content model selector — displays a numbered menu and returns
 * the chosen content model. Falls back to text input if the number is invalid.
 */
export async function askContentModel(defaultModel?: ContentModel): Promise<ContentModel> {
  const entries = Object.entries(CONTENT_MODEL_DESCRIPTIONS) as [ContentModel, string][];
  console.log('\n  Content model:\n');
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i] ?? entries[0];
    if (!entry) continue;
    const [key, desc] = entry;
    const marker = key === (defaultModel ?? 'generic') ? ' (default)' : '';
    console.log(`    \x1b[36m${i + 1}\x1b[0m. ${key.padEnd(12)} ${desc}${marker}`);
  }
  console.log('');

  const input = await ask('Choose content model (1-3)', defaultModel ?? 'generic');
  const num = Number(input);
  if (Number.isInteger(num) && num >= 1 && num <= entries.length) {
    return entries[num - 1]?.[0] ?? 'generic';
  }
  if (CONTENT_MODEL_DESCRIPTIONS[input as ContentModel]) {
    return input as ContentModel;
  }
  return 'generic';
}

// ── Channel selector ───────────────────────────────────────────────

/**
 * Interactive channel selector — choose between canary and latest.
 */
export async function askChannel(): Promise<'canary' | 'latest'> {
  console.log('\n  Release channel:\n');
  console.log('    \x1b[36m1\x1b[0m. canary      Bleeding-edge — every CI build');
  console.log('    \x1b[36m2\x1b[0m. latest       Production-ready releases');
  console.log('');

  const input = await ask('Choose channel (1-2)', 'canary');
  if (input === '2' || input === 'latest') return 'latest';
  return 'canary';
}
