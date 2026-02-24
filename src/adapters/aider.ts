import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { z } from 'zod';
import { defineAdapter } from './base.js';
import { safeReadYaml } from '../utils/file-reader.js';
import { classifyFinding } from '../risk/classifier.js';
import { makeFindingId } from '../utils/finding-id.js';
import type { Finding, NormalizedPermission } from '../types.js';

const AiderConfigSchema = z.object({
  yes: z.boolean().optional(),
  'auto-commits': z.boolean().optional(),
  shell: z.boolean().optional(),
  'skip-check': z.boolean().optional(),
}).passthrough();

const AGENT_ID = 'aider' as const;
const AGENT_LABEL = 'Aider';

const getConfigPaths = (projectDir: string) => [
  path.join(os.homedir(), '.aider.conf.yml'),
  path.join(projectDir, '.aider.conf.yml'),
];

const extractFindings = (config: z.infer<typeof AiderConfigSchema>, configPath: string, projectDir: string): Finding[] => {
  const findings: Finding[] = [];

  if (config.yes === true) {
    const permission: NormalizedPermission = {
      capability: 'shell',
      scope: 'global',
      persistence: 'always',
      constraints: [],
      rawKey: 'yes',
      rawValue: true,
    };
    const classified = classifyFinding(permission, 'SKIP_ALL_CONFIRMATIONS');
    findings.push({
      id: makeFindingId(AGENT_ID, 'yes', 'true'),
      agentId: AGENT_ID,
      agentLabel: AGENT_LABEL,
      configPath,
      projectDir,
      permission,
      ...classified,
      ruleId: 'SKIP_ALL_CONFIRMATIONS',
    });
  }

  if (config['auto-commits'] === true) {
    const permission: NormalizedPermission = {
      capability: 'fs-write',
      scope: 'repo',
      persistence: 'always',
      constraints: [],
      rawKey: 'auto-commits',
      rawValue: true,
    };
    const classified = classifyFinding(permission, 'AUTO_COMMITS_ENABLED');
    findings.push({
      id: makeFindingId(AGENT_ID, 'auto-commits', 'true'),
      agentId: AGENT_ID,
      agentLabel: AGENT_LABEL,
      configPath,
      projectDir,
      permission,
      ...classified,
      ruleId: 'AUTO_COMMITS_ENABLED',
    });
  }

  if (config.shell === true) {
    const permission: NormalizedPermission = {
      capability: 'shell',
      scope: 'global',
      persistence: 'always',
      constraints: [],
      rawKey: 'shell',
      rawValue: true,
    };
    const classified = classifyFinding(permission, 'SHELL_UNRESTRICTED_ALWAYS');
    findings.push({
      id: makeFindingId(AGENT_ID, 'shell', 'true'),
      agentId: AGENT_ID,
      agentLabel: AGENT_LABEL,
      configPath,
      projectDir,
      permission,
      ...classified,
      ruleId: 'SHELL_UNRESTRICTED_ALWAYS',
    });
  }

  return findings;
};

export const aiderAdapter = defineAdapter({
  agentId: AGENT_ID,
  agentLabel: AGENT_LABEL,

  detect(projectDir) {
    return getConfigPaths(projectDir).some(p => {
      try { return fs.existsSync(p); } catch { return false; }
    });
  },

  async scan(projectDir) {
    const findings: Finding[] = [];
    for (const configPath of getConfigPaths(projectDir)) {
      const raw = safeReadYaml(configPath);
      if (!raw) continue;
      const parsed = AiderConfigSchema.safeParse(raw);
      if (!parsed.success) continue;
      findings.push(...extractFindings(parsed.data, configPath, projectDir));
    }
    return findings;
  },
});
