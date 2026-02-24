export type Capability =
  | 'shell'
  | 'fs-read'
  | 'fs-write'
  | 'network'
  | 'mcp'
  | 'env'
  | 'secrets'
  | 'unknown';

export type Scope = 'global' | 'repo' | 'path' | 'unknown';
export type Persistence = 'always' | 'session' | 'once' | 'unknown';
export type RiskLevel = 'high' | 'medium' | 'low' | 'info';
export type AgentId = 'claude-code' | 'cursor' | 'codex' | 'gemini' | 'copilot' | 'aider';

export interface NormalizedPermission {
  capability: Capability;
  scope: Scope;
  persistence: Persistence;
  constraints: string[];
  rawKey: string;
  rawValue: unknown;
}

export interface Finding {
  id: string;
  agentId: AgentId;
  agentLabel: string;
  configPath: string;
  projectDir: string;
  permission: NormalizedPermission;
  riskLevel: RiskLevel;
  score: number;        // 1–10 severity score
  ruleId: string;
  title: string;
  description: string;
  remediation: string;
}

export interface ScanStats {
  configsChecked: number;
  configsFound: number;
  projectsScanned: number;
  durationMs: number;
}

export interface ScanSummary {
  agentsDetected: AgentId[];
  agentsScanned: AgentId[];
  findings: Finding[];
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  scannedAt: string;
  stats: ScanStats;
}

export interface AgentAdapter {
  agentId: AgentId;
  agentLabel: string;
  detect(projectDir: string): boolean;
  scan(projectDir: string): Promise<Finding[]>;
}

export interface ScanOptions {
  projectDir: string;
  json: boolean;
  quiet: boolean;
  depth: number;
  verbose: boolean;
}

export interface JsonOutput {
  version: string;
  scannedAt: string;
  summary: {
    agentsDetected: string[];
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  stats: ScanStats;
  findings: Finding[];
}
