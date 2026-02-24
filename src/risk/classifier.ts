import type { NormalizedPermission, RiskLevel } from '../types.js';
import { RULES } from './rules.js';

export interface ClassifiedFinding {
  riskLevel: RiskLevel;
  score: number;
  title: string;
  description: string;
  remediation: string;
}

const SENSITIVE_PATH_PATTERNS = [
  '.ssh', '.aws', '.gnupg', '.gpg', 'keychain', 'Keychain',
  '.env', '.npmrc', '.pypirc', '.netrc', '.git-credentials',
  'credentials', 'secrets', 'private_key', '.kube',
];

export const isSensitivePath = (p: string): boolean =>
  SENSITIVE_PATH_PATTERNS.some(pattern => p.includes(pattern));

export const classifyFinding = (
  permission: NormalizedPermission,
  ruleId: string,
): ClassifiedFinding => {
  const rule = RULES[ruleId];

  if (!rule) {
    return {
      riskLevel: 'info',
      score: 1,
      title: 'Unknown permission',
      description: `Unrecognized permission at key: ${permission.rawKey}`,
      remediation: 'Review this configuration key manually.',
    };
  }

  let riskLevel: RiskLevel = rule.defaultRiskLevel;
  let score = rule.baseScore;

  // Elevate medium → high when persistence=always AND scope=global
  if (permission.persistence === 'always' && permission.scope === 'global') {
    if (riskLevel === 'medium') {
      riskLevel = 'high';
      score = Math.min(10, score + 2);
    }
  }

  // Downgrade high → medium for session-only
  if (permission.persistence === 'session' && riskLevel === 'high') {
    riskLevel = 'medium';
    score = Math.max(1, score - 2);
  }

  // Downgrade for repo-scoped constraints
  if (permission.scope === 'repo' && riskLevel === 'medium') {
    score = Math.max(1, score - 1);
  }

  return {
    riskLevel,
    score,
    title: rule.title,
    description: rule.description,
    remediation: rule.remediation,
  };
};
