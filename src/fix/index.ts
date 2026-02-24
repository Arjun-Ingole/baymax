import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import chalk from 'chalk';
import yaml from 'js-yaml';
import { checkbox, confirm, Separator } from '@inquirer/prompts';
import type { Finding, ScanSummary } from '../types.js';
import { RISK_BADGE, contextualTitle } from '../output/renderer.js';

// ── Fix strategies ─────────────────────────────────────────────────────────────
//
// A fix knows which file to touch, what to describe, and how to apply itself.

export interface FixAction {
  findingId: string;
  configPath: string;
  label: string;           // shown in checkbox
  description: string;     // shown as hint
  apply(): void;
}

// Remove a string value from a JSON array at `arrayKey` (supports dot-notation: "permissions.allow")
const removeFromJsonArray = (configPath: string, arrayKey: string, value: string): void => {
  const raw = fs.readFileSync(configPath, 'utf-8');
  const obj = JSON.parse(raw) as Record<string, unknown>;

  // Resolve dot-notation key
  const keys = arrayKey.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cursor: any = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    cursor = cursor[keys[i]];
    if (!cursor || typeof cursor !== 'object') return;
  }
  const last = keys[keys.length - 1];
  if (!Array.isArray(cursor[last])) return;
  cursor[last] = (cursor[last] as string[]).filter(v => v !== value);

  // Clean up empty arrays and parent objects
  if ((cursor[last] as string[]).length === 0) {
    delete cursor[last];
  }

  fs.writeFileSync(configPath, JSON.stringify(obj, null, 2) + '\n', 'utf-8');
};

// Set or remove a key in a YAML file
const setYamlKey = (configPath: string, key: string, value: unknown): void => {
  const raw = fs.readFileSync(configPath, 'utf-8');
  const obj = (yaml.load(raw) ?? {}) as Record<string, unknown>;
  if (value === undefined) {
    delete obj[key];
  } else {
    obj[key] = value;
  }
  fs.writeFileSync(configPath, yaml.dump(obj), 'utf-8');
};

// ── Build fix actions from findings ───────────────────────────────────────────

const FIXABLE_RULES = new Set([
  'SHELL_UNRESTRICTED_ALWAYS',
  'SHELL_RESTRICTED_ALWAYS',
  'TOOL_ALWAYS_ALLOWED',
  'TRUSTED_DIR_GLOBAL',
  'SENSITIVE_PATH_TRUSTED',
  'SKIP_ALL_CONFIRMATIONS',
  'AUTO_COMMITS_ENABLED',
]);

export const buildFix = (f: Finding): FixAction | null => {
  if (!FIXABLE_RULES.has(f.ruleId)) return null;

  const rawValue = typeof f.permission.rawValue === 'string' ? f.permission.rawValue : null;
  const rawKey = f.permission.rawKey;
  const configPath = f.configPath;
  const ext = path.extname(configPath);

  const shortPath = configPath.replace(os.homedir(), '~');
  const title = contextualTitle(f);

  // JSON-based configs: remove from array
  if (ext === '.json' && rawValue !== null) {
    const arrayKey = rawKey; // e.g. "allowedTools" or "permissions.allow" or "trustedPaths"
    return {
      findingId: f.id,
      configPath,
      label: `${title}`,
      description: shortPath,
      apply() {
        removeFromJsonArray(configPath, arrayKey, rawValue);
      },
    };
  }

  // YAML (Aider): toggle boolean flags off
  if (ext === '.yml' || ext === '.yaml') {
    if (f.ruleId === 'SKIP_ALL_CONFIRMATIONS') {
      return {
        findingId: f.id,
        configPath,
        label: title,
        description: shortPath,
        apply() { setYamlKey(configPath, 'yes', undefined); },
      };
    }
    if (f.ruleId === 'AUTO_COMMITS_ENABLED') {
      return {
        findingId: f.id,
        configPath,
        label: title,
        description: shortPath,
        apply() { setYamlKey(configPath, 'auto-commits', false); },
      };
    }
  }

  return null;
};

// ── Interactive fix command ────────────────────────────────────────────────────

const shorten = (p: string) => p.replace(os.homedir(), '~');

export const runFix = async (summary: ScanSummary): Promise<void> => {
  const fixable = summary.findings
    .filter(f => !['info'].includes(f.riskLevel))
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2, info: 3 } as const;
      return order[a.riskLevel] - order[b.riskLevel];
    })
    .map(f => ({ finding: f, fix: buildFix(f) }))
    .filter(({ fix }) => fix !== null) as { finding: Finding; fix: FixAction }[];

  if (fixable.length === 0) {
    console.log(`\n  ${chalk.green('✓')}  ${chalk.green.bold('Nothing to fix')}  ${chalk.dim('— no automatically fixable issues found.')}\n`);
    return;
  }

  // Group by config file for display
  const byFile = new Map<string, { finding: Finding; fix: FixAction }[]>();
  for (const item of fixable) {
    const key = item.fix.configPath;
    if (!byFile.has(key)) byFile.set(key, []);
    byFile.get(key)!.push(item);
  }

  console.log();
  console.log(`  ${chalk.bold('Select issues to fix')}  ${chalk.dim(`(${fixable.length} fixable)`)}`);
  console.log(`  ${chalk.dim('Space to toggle · A to select all · Enter to confirm')}`);
  console.log();

  // Build checkbox choices grouped by file
  type Choice = { name: string; value: FixAction; checked: boolean };
  const choices: (Separator | Choice)[] = [];
  for (const [configPath, items] of byFile) {
    choices.push(new Separator(chalk.dim(`  ── ${shorten(configPath)}`)));
    for (const { finding, fix } of items) {
      choices.push({
        name: `${RISK_BADGE[finding.riskLevel]}  ${fix.label}`,
        value: fix,
        checked: finding.riskLevel === 'high' || finding.riskLevel === 'medium',
      });
    }
  }

  let selected: FixAction[];
  try {
    selected = (await checkbox<FixAction>({
      message: '',
      choices,
      pageSize: 20,
    })) as FixAction[];
  } catch {
    // User pressed Escape / Ctrl-C
    console.log(`\n  ${chalk.dim('Cancelled.')}\n`);
    return;
  }

  if (selected.length === 0) {
    console.log(`\n  ${chalk.dim('Nothing selected — no changes made.')}\n`);
    return;
  }

  console.log();

  let ok: boolean;
  try {
    ok = await confirm({
      message: `Apply ${selected.length} fix${selected.length !== 1 ? 'es' : ''}?`,
      default: true,
      theme: { prefix: ' ' },
    });
  } catch {
    console.log(`\n  ${chalk.dim('Cancelled.')}\n`);
    return;
  }

  if (!ok) {
    console.log(`\n  ${chalk.dim('No changes made.')}\n`);
    return;
  }

  console.log();

  // Apply — group output by file
  const changed = new Map<string, string[]>();
  const errors: string[] = [];

  for (const fix of selected) {
    try {
      fix.apply();
      if (!changed.has(fix.configPath)) changed.set(fix.configPath, []);
      changed.get(fix.configPath)!.push(fix.label);
    } catch (err) {
      errors.push(`${fix.label}: ${String(err)}`);
    }
  }

  for (const [configPath, labels] of changed) {
    console.log(`  ${chalk.green('✓')}  ${chalk.dim(shorten(configPath))}`);
    for (const label of labels) {
      console.log(`       ${chalk.dim('removed')}  ${chalk.white(label)}`);
    }
    console.log();
  }

  if (errors.length > 0) {
    for (const e of errors) {
      console.log(`  ${chalk.red('✗')}  ${e}`);
    }
    console.log();
  }

  console.log(`  ${chalk.green.bold(`${selected.length - errors.length} fix${selected.length - errors.length !== 1 ? 'es' : ''} applied`)}  ${chalk.dim('— run')} ${chalk.cyan('baymax scan')} ${chalk.dim('to verify.')}`);
  console.log();
};
