import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { z } from 'zod';
import { defineAdapter } from './base.js';
import { safeReadJson } from '../utils/file-reader.js';
import { classifyFinding, isSensitivePath } from '../risk/classifier.js';
import { makeFindingId } from '../utils/finding-id.js';
import type { Finding, NormalizedPermission } from '../types.js';

const CursorConfigSchema = z.object({
  permissions: z.object({
    allow: z.array(z.string()).optional(),
    deny: z.array(z.string()).optional(),
  }).optional(),
  trustedPaths: z.array(z.string()).optional(),
}).passthrough();

const AGENT_ID = 'cursor' as const;
const AGENT_LABEL = 'Cursor';

const getConfigPaths = (projectDir: string) => [
  path.join(os.homedir(), '.cursor', 'cli-config.json'),
  path.join(projectDir, '.cursor', 'cli.json'),
];

const extractFindings = (config: z.infer<typeof CursorConfigSchema>, configPath: string, projectDir: string): Finding[] => {
  const findings: Finding[] = [];

  for (const tool of config.permissions?.allow ?? []) {
    const isBashUnrestricted = tool === 'Bash' || tool === 'Bash(*)' || tool === 'terminal';
    const ruleId = isBashUnrestricted ? 'SHELL_UNRESTRICTED_ALWAYS' : 'TOOL_ALWAYS_ALLOWED';
    const permission: NormalizedPermission = {
      capability: isBashUnrestricted ? 'shell' : 'unknown',
      scope: isBashUnrestricted ? 'global' : 'repo',
      persistence: 'always',
      constraints: isBashUnrestricted ? [] : [tool],
      rawKey: 'permissions.allow',
      rawValue: tool,
    };
    const classified = classifyFinding(permission, ruleId);
    findings.push({
      id: makeFindingId(AGENT_ID, 'permissions.allow', tool),
      agentId: AGENT_ID,
      agentLabel: AGENT_LABEL,
      configPath,
      projectDir,
      permission,
      ...classified,
      ruleId,
    });
  }

  for (const trustedPath of config.trustedPaths ?? []) {
    const expandedPath = trustedPath.replace(/^~/, os.homedir());
    const isGlobal = expandedPath === os.homedir() || trustedPath === '/' || trustedPath === '~';
    const isSensitive = isSensitivePath(expandedPath);
    const ruleId = isSensitive ? 'SENSITIVE_PATH_TRUSTED' : isGlobal ? 'TRUSTED_DIR_GLOBAL' : 'FS_WRITE_REPO';
    const permission: NormalizedPermission = {
      capability: 'fs-write',
      scope: isGlobal || isSensitive ? 'global' : 'path',
      persistence: 'always',
      constraints: [trustedPath],
      rawKey: 'trustedPaths',
      rawValue: trustedPath,
    };
    const classified = classifyFinding(permission, ruleId);
    findings.push({
      id: makeFindingId(AGENT_ID, 'trustedpaths', trustedPath),
      agentId: AGENT_ID,
      agentLabel: AGENT_LABEL,
      configPath,
      projectDir,
      permission,
      ...classified,
      ruleId,
    });
  }

  return findings;
};

export const cursorAdapter = defineAdapter({
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
      const raw = safeReadJson(configPath);
      if (!raw) continue;
      const parsed = CursorConfigSchema.safeParse(raw);
      if (!parsed.success) continue;
      findings.push(...extractFindings(parsed.data, configPath, projectDir));
    }
    return findings;
  },
});
