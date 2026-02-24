import type { Finding, ScanSummary, AgentId } from '../types.js';

export const buildSummary = (
  findings: Finding[],
  agentsDetected: AgentId[],
  agentsScanned: AgentId[],
): ScanSummary => ({
  agentsDetected,
  agentsScanned,
  findings,
  highCount: findings.filter(f => f.riskLevel === 'high').length,
  mediumCount: findings.filter(f => f.riskLevel === 'medium').length,
  lowCount: findings.filter(f => f.riskLevel === 'low').length,
  infoCount: findings.filter(f => f.riskLevel === 'info').length,
  scannedAt: new Date().toISOString(),
});
