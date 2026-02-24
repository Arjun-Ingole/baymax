import { ALL_ADAPTERS } from './adapters/index.js';
import { buildSummary } from './risk/scorer.js';
import { logger } from './utils/logger.js';
import type { ScanOptions, ScanSummary, Finding, AgentId } from './types.js';

export const runScan = async (options: ScanOptions): Promise<ScanSummary> => {
  const { projectDir } = options;

  const detectedAdapters = ALL_ADAPTERS.filter(a => a.detect(projectDir));
  const agentsDetected: AgentId[] = detectedAdapters.map(a => a.agentId);

  const allFindings: Finding[] = [];
  const agentsScanned: AgentId[] = [];

  for (const adapter of detectedAdapters) {
    try {
      const findings = await adapter.scan(projectDir);
      allFindings.push(...findings);
      agentsScanned.push(adapter.agentId);
    } catch (err) {
      logger.warn(`Warning: could not scan ${adapter.agentLabel}: ${String(err)}`);
    }
  }

  return buildSummary(allFindings, agentsDetected, agentsScanned);
};
