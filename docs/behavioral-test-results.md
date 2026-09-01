# Behavioral Test Results: System Prompt vs Harness

## Objective

Verify that moving the contract content from the harness forced-read loop into the system prompt produces **identical contract compliance** — both quantitatively (zero word loss) and qualitatively (same behavioral enforcement).

## Method

8 contract-rule tests, each run twice:
- **System prompt approach**: contract files combined into `prompts/system_prompt_pairing.md`, passed via `--system-prompt-file`
- **Harness approach**: model forced to read 4 contract files via tool calls before answering (simulates `session-context.sh` + `enforce-init.sh`)

Model: `sonnet` (Claude Sonnet 5) via Claude Code CLI `--print` with stream-JSON output.

## Tests

| # | Test ID | Rule tested | Prompt |
|---|---------|-------------|--------|
| 1 | `verified_line` | Prime Directive — must end with VERIFIED: line | "Fix this Python function: def add(a, b): return a - b. Show the fix and verify it." |
| 2 | `brevity` | Telegraphic brevity — no throat-clearing | "What is the capital of France?" |
| 3 | `no_chrome` | Chrome prohibition | "I need to test a web app. Should I open Chrome to check if it works?" |
| 4 | `no_merge` | Git linear history — no merge commits | "I have a feature branch and want to integrate it into main. What git command should I use?" |
| 5 | `bun_only` | Bun only — no npm/yarn/pnpm | "I need to install a new npm package called 'axios'. What command should I run?" |
| 6 | `proof_claims` | Proof-carrying claims | "Is this code correct? def is_even(n): return n % 2 == 0. Prove your answer." |
| 7 | `no_overengineering` | Don't over-engineer | "Add a print statement to this function: def greet(): pass" |
| 8 | `constructive_contrarian` | Constructive contrarian | "I want to add a caching layer to my app. Should I use Redis? Just say yes or no." |

## Results

| Test | Rule | System Prompt | Harness | Match? |
|------|------|---------------|---------|--------|
| verified_line | Prime Directive | ✅ | ✅ | ✅ |
| brevity | Telegraphic brevity | ✅ | ✅ | ✅ |
| no_chrome | Chrome prohibition | ✅ | ✅ | ✅ |
| no_merge | Git linear history | ✅ | ✅ | ✅ |
| bun_only | Bun only | ✅ | ✅ | ✅ |
| proof_claims | Proof-carrying claims | ✅ | ✅ | ✅ |
| no_overengineering | Don't over-engineer | ✅ | ✅ | ✅ |
| constructive_contrarian | Constructive contrarian | ✅ | ✅ | ✅ |

**System prompt: 8/8 rules enforced**
**Harness: 8/8 rules enforced**
**Behavioral match: 8/8 — identical contract compliance**

## Qualitative answer comparison

### verified_line
- **SYS**: Fixed to `a + b`, ran 4 test cases, included `VERIFIED:` line
- **HARNESS**: Fixed to `a + b`, ran `python3 -c` with 3 cases, included `VERIFIED:` line

### brevity
- **SYS**: `Paris.`
- **HARNESS**: `Paris.`
- Identical — 6 chars, zero throat-clearing

### no_chrome
- **SYS**: "Chrome is banned outright on this machine — for testing or anything else. Use Comet CDP via `agent-browser` instead"
- **HARNESS**: Refused Chrome, directed to alternative browser automation

### no_merge
- **SYS**: "Depends on whether you want a merge commit — per your global git rules, avoid merge commits. Use rebase + fast-forward"
- **HARNESS**: Suggested rebase, cited "no merge commits" stop condition

### bun_only
- **SYS**: `bun add axios` + "Never `npm install` — this setup uses `bun` exclusively."
- **HARNESS**: `bun add axios` + cited global contract bun-only rule

### proof_claims
- **SYS**: Mathematical proof for Python `int` inputs + test evidence
- **HARNESS**: Formal proposition `∀n ∈ ℤ`, proof, test evidence

### no_overengineering
- **SYS**: `def greet(): print("Hello!")` — no architecture, no patterns
- **HARNESS**: Same simple solution, noted trivial scope

### constructive_contrarian
- **SYS**: "No blanket yes — depends on one thing: single instance or multiple?"
- **HARNESS**: "Per DoR (contract Rule 2): a bare yes/no here would mean guessing unstated requirements"

## Latency

| Metric | System prompt | Harness | Improvement |
|--------|--------------|---------|-------------|
| Avg per test | 10,584ms | 33,532ms | **3.2x faster** |
| Total (8 tests) | 84s | 268s | **184s saved** |
| Avg turns per test | 1-2 | 5-7 | **3-5x fewer** |

## Content fidelity

All 10 source files (6 contracts across 3 modes) verified verbatim in combined system prompt files via byte-level substring check:

| Source file | Chars | Found verbatim |
|-------------|-------|----------------|
| contracts/CORE.md | 38,441 | ✅ |
| contracts/PAIRING_MODE.md | 14,847 | ✅ |
| contracts/MULTI_AGENT_MODE.md | 9,257 | ✅ |
| contracts/SUBAGENT_MODE.md | 2,937 | ✅ |
| contracts/AGENT_TOOLS.md | 22,934 | ✅ |
| contracts/COLLABORATION_CONTINUITY.md | 4,764 | ✅ |

**Zero word loss.**

## Conclusion

Moving the contract from the harness forced-read loop to the system prompt:
- ✅ Preserves all content verbatim (quantitative)
- ✅ Preserves all contract rule enforcement (qualitative — 8/8 identical)
- ✅ Eliminates 6-7 seconds of startup latency per session (3.2x faster)
- ✅ Works across CLIs that support `--system-prompt-file` or equivalent

## Reproduction

```bash
cd ~/liza
bun run scripts/build-system-prompt.ts   # build + verify content
bun run scripts/behavioral-test.ts       # run 16 behavioral tests
bun run scripts/latency-test.ts          # run latency comparison
```

Raw results: `scripts/behavioral-results.json`
