import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { z } from 'zod';
import { defineAdapter } from './base.js';
import { safeReadToml } from '../utils/file-reader.js';
import { classifyFinding } from '../risk/classifier.js';
import { makeFindingId } from '../utils/finding-id.js';
import type { Finding, NormalizedPermission } from '../types.js';

const CodexConfigSchema = z.object({
  approval_policy: z.string().optional(),
  sandbox: z.object({
    enabled: z.boolean().optional(),
  }).optional(),
  full_auto: z.boolean().optional(),
}).passthrough();

const AGENT_ID = 'codex' as const;
const AGENT_LABEL = 'Codex CLI';

const getConfigPaths = () => {
  const home = os.homedir();
  return [path.join(home, '.codex', 'config.toml')];
};

const extractFindings = (config: z.infer<typeof CodexConfigSchema>, configPath: string, projectDir: string): Finding[] => {
  const findings: Finding[] = [];

  if (config.approval_policy === 'auto' || config.full_auto === true) {
    const ruleId = 'APPROVAL_POLICY_AUTO';
    const permission: NormalizedPermission = {
      capability: 'shell',
      scope: 'global',
      persistence: 'always',
      constraints: [],
      rawKey: config.full_auto ? 'full_auto' : 'approval_policy',
      rawValue: config.full_auto ? true : config.approval_policy,
    };
    const classified = classifyFinding(permission, ruleId);
    findings.push({
      id: makeFindingId(AGENT_ID, 'approval_policy', 'auto'),
      agentId: AGENT_ID,
      agentLabel: AGENT_LABEL,
      configPath,
      projectDir,
      permission,
      ...classified,
      ruleId,
    });
  }

  if (config.sandbox?.enabled === false) {
    const permission: NormalizedPermission = {
      capability: 'shell',
      scope: 'global',
      persistence: 'always',
      constraints: [],
      rawKey: 'sandbox.enabled',
      rawValue: false,
    };
    const classified = classifyFinding(permission, 'SANDBOX_DISABLED');
    findings.push({
      id: makeFindingId(AGENT_ID, 'sandbox.enabled', 'false'),
      agentId: AGENT_ID,
      agentLabel: AGENT_LABEL,
      configPath,
      projectDir,
      permission,
      ...classified,
      ruleId: 'SANDBOX_DISABLED',
    });
  }

  return findings;
};

export const codexAdapter = defineAdapter({
  agentId: AGENT_ID,
  agentLabel: AGENT_LABEL,

  detect() {
    return getConfigPaths().some(p => {
      try { return fs.existsSync(p); } catch { return false; }
    });
  },

  async scan(projectDir) {
    const findings: Finding[] = [];
    for (const configPath of getConfigPaths()) {
      const raw = safeReadToml(configPath);
      if (!raw) continue;
      const parsed = CodexConfigSchema.safeParse(raw);
      if (!parsed.success) continue;
      findings.push(...extractFindings(parsed.data, configPath, projectDir));
    }
    return findings;
  },
});
