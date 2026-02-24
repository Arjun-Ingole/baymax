import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { z } from 'zod';
import { defineAdapter } from './base.js';
import { safeReadJson } from '../utils/file-reader.js';
import { classifyFinding, isSensitivePath } from '../risk/classifier.js';
import { makeFindingId } from '../utils/finding-id.js';
import type { Finding, NormalizedPermission } from '../types.js';

const CopilotConfigSchema = z.object({
  permanentlyTrustedDirectories: z.array(z.string()).optional(),
  allowedTools: z.array(z.string()).optional(),
  networkAccess: z.boolean().optional(),
}).passthrough();

const AGENT_ID = 'copilot' as const;
const AGENT_LABEL = 'GitHub Copilot';

const getConfigPaths = () => [path.join(os.homedir(), '.copilot', 'config.json')];

const extractFindings = (config: z.infer<typeof CopilotConfigSchema>, configPath: string, projectDir: string): Finding[] => {
  const findings: Finding[] = [];

  for (const dir of config.permanentlyTrustedDirectories ?? []) {
    const expandedPath = dir.replace(/^~/, os.homedir());
    const isGlobal = expandedPath === os.homedir() || dir === '/' || dir === '~';
    const isSensitive = isSensitivePath(expandedPath);
    const ruleId = isSensitive ? 'SENSITIVE_PATH_TRUSTED' : isGlobal ? 'TRUSTED_DIR_GLOBAL' : 'FS_WRITE_REPO';
    const permission: NormalizedPermission = {
      capability: 'fs-write',
      scope: isGlobal || isSensitive ? 'global' : 'path',
      persistence: 'always',
      constraints: [dir],
      rawKey: 'permanentlyTrustedDirectories',
      rawValue: dir,
    };
    const classified = classifyFinding(permission, ruleId);
    findings.push({
      id: makeFindingId(AGENT_ID, 'permanentlytrusted', dir),
      agentId: AGENT_ID,
      agentLabel: AGENT_LABEL,
      configPath,
      projectDir,
      permission,
      ...classified,
      ruleId,
    });
  }

  if (config.networkAccess === true) {
    const permission: NormalizedPermission = {
      capability: 'network',
      scope: 'global',
      persistence: 'always',
      constraints: [],
      rawKey: 'networkAccess',
      rawValue: true,
    };
    const classified = classifyFinding(permission, 'NETWORK_UNRESTRICTED');
    findings.push({
      id: makeFindingId(AGENT_ID, 'networkaccess', 'true'),
      agentId: AGENT_ID,
      agentLabel: AGENT_LABEL,
      configPath,
      projectDir,
      permission,
      ...classified,
      ruleId: 'NETWORK_UNRESTRICTED',
    });
  }

  return findings;
};

export const copilotAdapter = defineAdapter({
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
      const raw = safeReadJson(configPath);
      if (!raw) continue;
      const parsed = CopilotConfigSchema.safeParse(raw);
      if (!parsed.success) continue;
      findings.push(...extractFindings(parsed.data, configPath, projectDir));
    }
    return findings;
  },
});
