# Baymax

A local CLI that scans AI coding agent configs for dangerous "always allow" permissions and warns before they become silent long-term risk.

```
  Baymax  v1.0.0  ·  AI agent permission scanner

  Claude Code  ·  ~/.claude/settings.json
  ────────────────────────────────────────────────────────────
  ! [HIGH]   Unrestricted shell execution always allowed
             Bash(*) permanently allowed — any command runs without confirmation.
             → Remove "Bash" from allowedTools. Use "Bash(npm run *)" instead.
             ID: claude-code::allowedtools::bash

  ┌────────────────────────────────────┐
  │  1 high  ·  0 medium  ·  0 low    │
  │  3 agents detected, 3 scanned     │
  └────────────────────────────────────┘
```

## Problem

Modern coding agents reduce friction with "Allow always" buttons. Developers click through to stay in flow, then forget. The result is long-lived silent trust across shell execution, filesystem access, MCP servers, and network — permission drift wearing a friendly hoodie.

## What Baymax scans

| Agent | What it checks |
|-------|---------------|
| **Claude Code** | `allowedTools` (Bash/Bash(*)), registered MCP servers |
| **Cursor** | `permissions.allow`, `trustedPaths` |
| **Codex CLI** | `approval_policy: auto`, `sandbox.enabled: false` |
| **Gemini CLI** | `trustedFolders`, `sandboxEnabled: false`, MCP servers |
| **GitHub Copilot** | `permanentlyTrustedDirectories`, `networkAccess: true` |
| **Aider** | `yes: true`, `auto-commits: true`, `shell: true` |

## Install

```bash
# From source
git clone <repo>
cd baymax
npm install && npm run build
npm link          # makes `baymax` available globally
```

## Usage

```bash
# Scan current directory + global agent configs
baymax scan .

# Scan a specific project
baymax scan ~/projects/myapp

# Machine-readable output (exit 1 if high findings)
baymax scan . --json

# High-risk findings only
baymax scan . --quiet

# Full detail and remediation for a specific finding
baymax explain claude-code::allowedtools::bash

# Export Markdown audit report
baymax export --md --output ./security-report.md
```

## Risk levels

| Level | Meaning | Example |
|-------|---------|---------|
| **HIGH** | Immediate concern, mitigate now | Unrestricted Bash, sandbox disabled, auto-approve all |
| **MEDIUM** | Review and consider scoping | Restricted shell patterns, MCP servers, auto-commits |
| **LOW** | Noted, likely acceptable | Tool permanently allowed (non-shell) |

**Risk escalation:** Medium findings are elevated to High when `persistence=always` AND `scope=global`.

## CI integration

`baymax scan` exits with code `1` when any high-risk findings are detected:

```yaml
# GitHub Actions example
- name: Audit agent permissions
  run: baymax scan .
```

## Development

```bash
npm run build          # compile TypeScript
npm test               # run 80 tests
npm run test:watch     # watch mode
npm run test:coverage  # coverage report
```

See [CLAUDE.md](./CLAUDE.md) for architecture details and how to add new adapters.

## Philosophy

Baymax audits capabilities, not intent. It doesn't care why you allowed something — only what that permission enables. Soft, calm, and quietly watching for harm.

> "Humans forget, and systems remember. Software that gently restores memory without blocking creativity is surprisingly rare."
