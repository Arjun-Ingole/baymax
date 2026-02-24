import { claudeCodeAdapter } from './claude-code.js';
import { cursorAdapter } from './cursor.js';
import { codexAdapter } from './codex.js';
import { geminiAdapter } from './gemini.js';
import { copilotAdapter } from './copilot.js';
import { aiderAdapter } from './aider.js';
import type { AgentAdapter } from '../types.js';

export const ALL_ADAPTERS: AgentAdapter[] = [
  claudeCodeAdapter,
  cursorAdapter,
  codexAdapter,
  geminiAdapter,
  copilotAdapter,
  aiderAdapter,
];
