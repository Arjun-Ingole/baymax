import type { AgentAdapter, AgentId, Finding } from '../types.js';

export interface AdapterConfig {
  agentId: AgentId;
  agentLabel: string;
  detect: (projectDir: string) => boolean;
  scan: (projectDir: string) => Promise<Finding[]>;
}

export const defineAdapter = (config: AdapterConfig): AgentAdapter => config;
