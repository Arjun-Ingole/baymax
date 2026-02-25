# Baymax

A local CLI that scans AI coding agent configs for dangerous "always allow" permissions — before they become silent long-term risk.

```
  ╭────────╮   baymax  v1.0.0
  │  ·  ·  │   AI agent permission scanner
  │  ────  │   ███████████░░░░░░░░░  57/100
  ╰────────╯   stay alert

   Claude Code   ~/.claude/settings.local.json

  MED   Bash(cat:*)
       cat — reads any file — can expose .env files, SSH keys, tokens in your project

  MED   Bash(git add:*)
       git add — stages files for commit — can include .env or secrets before anyone reviews

  0 high  ·  2 medium  ·  0 low  ·  12ms  ·  1 agent  ·  14:32:01
```

## Problem

Modern coding agents reduce friction with "Allow always" buttons. Developers click through to stay in flow, then forget. The result is long-lived silent trust across shell execution, filesystem access, MCP servers, and network — permission drift wearing a friendly hoodie.

## What Baymax scans

| Agent | What it checks |
|-------|---------------|
| **Claude Code** | `allowedTools` (Bash, Bash(*), tool entries), `permissions.allow`, MCP servers + secrets in env |
| **Cursor** | `permissions.allow`, `trustedPaths` |
| **Codex CLI** | `approval_policy: auto`, `full_auto: true`, `sandbox.enabled: false` |
| **Gemini CLI** | `trustedFolders`, `sandboxEnabled: false`, MCP servers |
| **GitHub Copilot** | `permanentlyTrustedDirectories`, `networkAccess: true` |
| **Aider** | `yes: true`, `auto-commits: true`, `shell: true` |

## Install from source (development)

```bash
git clone <repo>
cd baymax
npm install && npm run build
npm link          # makes `baymax` available globally
```

## Install from npm

```bash
npm install -g baymax-cli
baymax --help
```

## Usage

```bash
# Scan current directory (+ global agent configs like ~/.claude/settings.json)
baymax scan .

# Scan a specific project
baymax scan ~/projects/myapp

# Recursively scan subdirectories up to depth 3
baymax scan . --depth 3

# High-risk findings only (quiet mode)
baymax scan . --quiet

# Machine-readable JSON output (exits 1 if any high findings — useful in CI)
baymax scan . --json

# Interactively fix risky permissions in-place
baymax fix .

# Export a Markdown audit report
baymax export --md --output ./security-report.md
```

## Risk levels

| Level | Meaning | Example |
|-------|---------|---------|
| **HIGH** | Immediate concern — mitigate now | Unrestricted Bash, sandbox disabled, auto-approve all |
| **MEDIUM** | Review and consider scoping | Known-risky commands permanently allowed (node, python, git, curl…) |
| **LOW** | Noted, likely acceptable | Specific tools or unknown commands permanently allowed |

**Risk escalation:** Medium findings are elevated to High when `persistence=always` AND `scope=global`.

**Smart tiering:** Restricted shell patterns like `Bash(sqlite3:*)` or `Bash(npx standard:*)` are classified LOW rather than MED — only commands with known-risky capabilities (code execution, filesystem traversal, network, git) stay at MED.

## Fix command

`baymax fix` runs a scan then opens an interactive checkbox:

- High and medium findings are **pre-checked**
- Low findings are **unchecked** by default
- Select with `Space`, confirm with `Enter`
- Fixes are applied in-place to the config files (removes array entries, toggles booleans)

## CI integration

`baymax scan` exits with code `1` when any high-risk findings are detected:

```yaml
# GitHub Actions
- name: Audit agent permissions
  run: baymax scan .
```

## Development

```bash
npm run build          # compile TypeScript → dist/
npm test               # run 88 tests across 10 test files
npm run test:watch     # watch mode
npm run test:coverage  # coverage report
```

### Adding a new agent adapter

1. Create `src/adapters/<agent-id>.ts` — implement `detect(projectDir)` and `scan(projectDir)`
2. Register it in `src/adapters/index.ts`
3. Add fixture files under `src/__fixtures__/`
4. Add tests in `src/adapters/<agent-id>.test.ts`

See any existing adapter (e.g. `claude-code.ts`) as the reference implementation. Each adapter normalizes its config into `NormalizedPermission` objects and calls `classifyFinding()` to get risk level + score.

## Architecture

```
cli.ts                  → Commander commands (scan, fix, export)
scan.ts                 → Orchestrator: discover projects → run adapters → deduplicate
adapters/               → One file per agent, each implementing AgentAdapter
risk/rules.ts           → Rule registry: ruleId → title, description, remediation, baseScore
risk/classifier.ts      → classifyFinding(): permission + ruleId → RiskLevel + score
risk/scorer.ts          → buildSummary(): aggregate findings into ScanSummary
output/renderer.ts      → Terminal output with mascot, safety score bar, agent badges
output/json-reporter.ts → --json output
output/markdown-reporter.ts → export --md
fix/index.ts            → Interactive fix command
```

## Philosophy

Baymax audits capabilities, not intent. It doesn't care why you allowed something — only what that permission enables. Soft, calm, and quietly watching for harm.

> "Humans forget, and systems remember. Software that gently restores memory without blocking creativity is surprisingly rare."
