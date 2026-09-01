# System Prompt Deployment Guide

The contract files are now combined into a single system prompt file per mode, eliminating the forced-read initialization loop.

## What changed

**Before:** SessionStart hook → forced read of 4-7 files via tool calls → 6-10s startup overhead per session.

**After:** Contract content is in the system prompt → 0.1-0.5s overhead → no forced reads.

## Files

| File | Mode | Contents |
|------|------|----------|
| `prompts/system_prompt_pairing.md` | Default (no agent ID) | CORE + PAIRING_MODE + AGENT_TOOLS + COLLABORATION_CONTINUITY |
| `prompts/system_prompt_multi_agent.md` | Multi-agent (agent ID set) | CORE + MULTI_AGENT_MODE + AGENT_TOOLS |
| `prompts/system_prompt_subagent.md` | Subagent | CORE + SUBAGENT_MODE + AGENT_TOOLS |

Project-specific files (GUARDRAILS.md, REPOSITORY.md, docs/USAGE.md) are NOT in the system prompt — they vary per project and should be loaded via AGENTS.md or read on demand.

## Per-CLI deployment

### Claude Code

```bash
# Replace mode (drops Claude Code's default prompt entirely):
claude --system-prompt-file prompts/system_prompt_pairing.md

# Append mode (keeps Claude Code's default + adds contract):
claude --append-system-prompt-file prompts/system_prompt_pairing.md
```

For persistent use, add to `.claude/settings.json`:
```json
{
  "systemPromptFile": "prompts/system_prompt_pairing.md"
}
```

**Hooks:** The `SessionStart` hook (`session-context.sh`) and `PreToolUse` enforcement hook (`enforce-init.sh`) are removed from `claude-settings.json`. The remaining hooks (git-guard, rtk-guard, worktree-path-guard) are preserved.

### Codex

```toml
# .codex/config.toml
model_instructions_file = "prompts/system_prompt_pairing.md"
```

This replaces Codex's built-in instructions entirely. AGENTS.md is still loaded as a separate layer.

### Devin CLI

Devin CLI does not support `--system-prompt-file`. Use AGENTS.md instead:

```bash
# Copy the system prompt content into AGENTS.md at project root
cp prompts/system_prompt_pairing.md AGENTS.md
```

Note: Devin CLI docs recommend keeping AGENTS.md concise. The full contract is ~82KB. For Devin, consider using a trimmed version with only the most critical rules.

### Pi

```bash
# Replace Pi's default system prompt:
cp prompts/system_prompt_pairing.md .pi/SYSTEM.md

# Or append:
cp prompts/system_prompt_pairing.md .pi/APPEND_SYSTEM.md
```

Pi's default system prompt is <1,000 tokens. Replacing it with the full contract (~20K tokens) changes Pi's minimal-prompt philosophy. Consider whether this is desired.

### DeepSeek Harness

DeepSeek Harness reads AGENTS.md and CLAUDE.md automatically. For system prompt replacement, use the `SystemPrompt` service configuration:

```toml
# .deepseek/config.toml
[system_prompt]
include_harness_identity = false
persona = "prompts/system_prompt_pairing.md"
```

## Building

```bash
bun run scripts/build-system-prompt.ts
```

This script:
1. Reads all contract files from `contracts/`
2. Concatenates them with section headers
3. Verifies byte-level that every source file is present verbatim
4. Outputs to `prompts/system_prompt_*.md`

## Verification

The build script verifies zero word loss. To manually verify:

```bash
# Check that each contract file appears verbatim in the combined prompt
python3 -c "
source = open('contracts/CORE.md').read().rstrip()
combined = open('prompts/system_prompt_pairing.md').read()
assert source in combined, 'CORE.md content missing!'
print('✅ CORE.md found verbatim')
"
```

## What is NOT in the system prompt

These files are project-specific and must be loaded separately:

- `GUARDRAILS.md` — project-specific constraints (read on demand)
- `REPOSITORY.md` — project structure overview (read on demand)
- `docs/USAGE.md` — project usage docs (read on demand)

The base prompt template (`base_prompt.tmpl`) still instructs the agent to read `GUARDRAILS.md` if it exists — this is a single file read, not the multi-file forced-read loop.

## Trade-offs

| Aspect | Harness (before) | System prompt (after) |
|--------|-----------------|----------------------|
| First message latency | 6-10s | 0.1-0.5s |
| Content authority | Tool result (active) | System prompt (passive) |
| Token cost (first call) | Higher (cache misses) | Lower (cached after first call) |
| Cross-CLI portability | Requires hook per CLI | Works everywhere with system prompt support |
| Content fidelity | Identical | Identical (verified byte-level) |
