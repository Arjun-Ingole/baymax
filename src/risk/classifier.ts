import type { NormalizedPermission, RiskLevel } from '../types.js';
import { RULES } from './rules.js';

export interface ClassifiedFinding {
  riskLevel: RiskLevel;
  title: string;
  description: string;
  remediation: string;
}

export const classifyFinding = (
  permission: NormalizedPermission,
  ruleId: string,
): ClassifiedFinding => {
  const rule = RULES[ruleId];

  if (!rule) {
    return {
      riskLevel: 'info',
      title: 'Unknown permission',
      description: `Unrecognized permission at key: ${permission.rawKey}`,
      remediation: 'Review this configuration key manually.',
    };
  }

  let riskLevel: RiskLevel = rule.defaultRiskLevel;

  // Elevate medium → high when always + global
  if (permission.persistence === 'always' && permission.scope === 'global') {
    if (riskLevel === 'medium') riskLevel = 'high';
  }

  // Downgrade high → medium for session-only
  if (permission.persistence === 'session' && riskLevel === 'high') {
    riskLevel = 'medium';
  }

  return {
    riskLevel,
    title: rule.title,
    description: rule.description,
    remediation: rule.remediation,
  };
};
