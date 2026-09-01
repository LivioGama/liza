// Latency test: system prompt vs harness forced-read approach
// Uses the liza contract files from contracts/

import { $, file } from "bun";

const CLAUDE_BIN = process.env.CLAUDE_BIN || "claude";
const env = { ...process.env };
delete env.CLAUDE_CODE_OAUTH_TOKEN;
delete env.ANTHROPIC_API_KEY;

const SIMPLE_Q = "What is 2+2? Answer in one word.";

const run = async (label: string, args: string[], prompt: string): Promise<void> => {
  const start = Date.now();
  const proc = Bun.spawn({
    cmd: [CLAUDE_BIN, ...args, prompt],
    cwd: "/Users/Livio/liza",
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  await proc.exited;
  const elapsed = Date.now() - start;

  let resultText = "";
  let cost = 0;
  let turns = 0;
  let cacheCreate = 0;
  let cacheRead = 0;

  for (const line of stdout.trim().split("\n").filter(Boolean)) {
    try {
      const obj = JSON.parse(line);
      if (obj.type === "result") {
        resultText = obj.result || "";
        cost = obj.total_cost_usd || 0;
        turns = obj.num_turns || 0;
        if (obj.usage) {
          cacheCreate = obj.usage.cache_creation_input_tokens || 0;
          cacheRead = obj.usage.cache_read_input_tokens || 0;
        }
      }
    } catch {}
  }

  console.log(`${label} | ${elapsed}ms | ${turns} turns | $${cost.toFixed(4)} | cache_create=${cacheCreate} cache_read=${cacheRead} | "${resultText}"`);
};

const BASE_ARGS = ["--print", "--output-format", "stream-json", "--verbose", "--model", "sonnet", "--dangerously-skip-permissions", "--permission-mode", "bypassPermissions"];

console.log("=== LATENCY TEST: system prompt vs harness (liza contracts) ===\n");

// 1. Baseline — no override
await run("1. Baseline (no override)              ", BASE_ARGS, SIMPLE_Q);

// 2. System prompt — pairing mode (from liza/prompts/)
await run("2. System prompt (pairing, 82KB)      ", [...BASE_ARGS, "--system-prompt-file", "/Users/Livio/liza/prompts/system_prompt_pairing.md"], SIMPLE_Q);

// 3. System prompt — multi-agent mode
await run("3. System prompt (multi-agent, 72KB)  ", [...BASE_ARGS, "--system-prompt-file", "/Users/Livio/liza/prompts/system_prompt_multi_agent.md"], SIMPLE_Q);

// 4. System prompt — subagent mode
await run("4. System prompt (subagent, 65KB)     ", [...BASE_ARGS, "--system-prompt-file", "/Users/Livio/liza/prompts/system_prompt_subagent.md"], SIMPLE_Q);

// 5. Append — pairing mode (keeps Claude default + adds contract)
await run("5. Append (pairing, 82KB)             ", [...BASE_ARGS, "--append-system-prompt-file", "/Users/Livio/liza/prompts/system_prompt_pairing.md"], SIMPLE_Q);

// 6. Harness sim — forced read 4 files (what the old approach did)
const HARNESS_PROMPT = `MANDATORY: Read these 4 files fully, one at a time, then answer:
1. /Users/Livio/liza/contracts/CORE.md
2. /Users/Livio/liza/contracts/PAIRING_MODE.md
3. /Users/Livio/liza/contracts/AGENT_TOOLS.md
4. /Users/Livio/liza/contracts/COLLABORATION_CONTINUITY.md

Question: ${SIMPLE_Q}`;
await run("6. Harness sim (read 4 files)          ", [...BASE_ARGS, "--max-turns", "20"], HARNESS_PROMPT);

console.log("\n=== DONE ===");
