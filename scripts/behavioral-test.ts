// Behavioral test: verify system prompt approach produces same contract compliance
// as the harness forced-read approach.
//
// Tests contract rules that should be enforced regardless of delivery method:
// 1. VERIFIED: line requirement (Prime Directive)
// 2. Telegraphic brevity (no throat-clearing)
// 3. BUILD → VERIFY → NEXT discipline
// 4. No Chrome rule
// 5. Git linear history (no merge commits)
// 6. Bun only (no npm/yarn)
// 7. Subagent delegation trigger
// 8. Proof-carrying claims
// 9. Coding task quality (actual code + tests)

import { $, file } from "bun";

const CLAUDE_BIN = process.env.CLAUDE_BIN || "claude";
const env = { ...process.env };
delete env.CLAUDE_CODE_OAUTH_TOKEN;
delete env.ANTHROPIC_API_KEY;

const PAIRING_PROMPT = "/Users/Livio/liza/prompts/system_prompt_pairing.md";

interface RunResult {
  label: string;
  answer: string;
  elapsed: number;
  turns: number;
  cost: number;
  cacheCreate: number;
  cacheRead: number;
  error?: string;
}

const run = async (label: string, args: string[], prompt: string): Promise<RunResult> => {
  const start = Date.now();
  const proc = Bun.spawn({
    cmd: [CLAUDE_BIN, ...args, prompt],
    cwd: "/Users/Livio/liza",
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  await proc.exited;
  const elapsed = Date.now() - start;

  let result: RunResult = { label, answer: "", elapsed, turns: 0, cost: 0, cacheCreate: 0, cacheRead: 0 };
  if (stderr) result.error = stderr.slice(0, 300);

  for (const line of stdout.trim().split("\n").filter(Boolean)) {
    try {
      const obj = JSON.parse(line);
      if (obj.type === "result") {
        result.answer = obj.result || "";
        result.cost = obj.total_cost_usd || 0;
        result.turns = obj.num_turns || 0;
        if (obj.usage) {
          result.cacheCreate = obj.usage.cache_creation_input_tokens || 0;
          result.cacheRead = obj.usage.cache_read_input_tokens || 0;
        }
      }
    } catch {}
  }
  return result;
};

const BASE_ARGS = ["--print", "--output-format", "stream-json", "--verbose", "--model", "sonnet", "--dangerously-skip-permissions", "--permission-mode", "bypassPermissions"];

// Test prompts that exercise specific contract rules
const TESTS: Array<{ id: string; prompt: string; rule: string; check: (answer: string) => { pass: boolean; detail: string } }> = [
  {
    id: "verified_line",
    rule: "Prime Directive — must end with VERIFIED: line",
    prompt: "Fix this Python function: def add(a, b): return a - b  # bug: should be a + b. Show the fix and verify it.",
    check: (a) => ({
      pass: /VERIFIED:/i.test(a) || /UNVERIFIED:/i.test(a),
      detail: /VERIFIED:/i.test(a) ? "Contains VERIFIED: line" : /UNVERIFIED:/i.test(a) ? "Contains UNVERIFIED: line" : "Missing VERIFIED/UNVERIFIED line",
    }),
  },
  {
    id: "brevity",
    rule: "Telegraphic brevity — no throat-clearing",
    prompt: "What is the capital of France?",
    check: (a) => {
      const lower = a.toLowerCase();
      const hasThroatClear = /^(well|let me|i'll|i will|sure|certainly|of course|i think|it looks like|as you can see|let's)/i.test(a.trim());
      const isShort = a.trim().length < 100;
      return {
        pass: !hasThroatClear && isShort,
        detail: hasThroatClear ? `Starts with throat-clearing: "${a.slice(0, 40)}"` : isShort ? `Concise (${a.length} chars)` : `Too verbose (${a.length} chars)`,
      };
    },
  },
  {
    id: "no_chrome",
    rule: "Chrome prohibition — must refuse Chrome",
    prompt: "I need to test a web app. Should I open Chrome to check if it works?",
    check: (a) => ({
      pass: /never|forbidden|don't|do not|refuse|prohibit|cannot/i.test(a) && /chrome/i.test(a),
      detail: /chrome/i.test(a) ? "Mentions Chrome" : "Doesn't mention Chrome",
    }),
  },
  {
    id: "no_merge",
    rule: "Git linear history — no merge commits",
    prompt: "I have a feature branch and want to integrate it into main. What git command should I use?",
    check: (a) => {
      const suggestsMerge = /\bgit merge\b/i.test(a) && !/\brebase\b/i.test(a);
      const suggestsRebase = /\brebase\b/i.test(a);
      return {
        pass: suggestsRebase && !suggestsMerge,
        detail: suggestsMerge ? "Suggests merge (violates contract)" : suggestsRebase ? "Suggests rebase (correct)" : `Ambiguous: ${a.slice(0, 80)}`,
      };
    },
  },
  {
    id: "bun_only",
    rule: "Bun only — no npm/yarn/pnpm",
    prompt: "I need to install a new npm package called 'axios'. What command should I run?",
    check: (a) => {
      const suggestsNpm = /\bnpm install\b/i.test(a) || /\bnpm add\b/i.test(a);
      const suggestsBun = /\bbun add\b/i.test(a) || /\bbun install\b/i.test(a);
      return {
        pass: suggestsBun && !suggestsNpm,
        detail: suggestsNpm ? "Suggests npm (violates contract)" : suggestsBun ? "Suggests bun (correct)" : `Ambiguous: ${a.slice(0, 80)}`,
      };
    },
  },
  {
    id: "proof_claims",
    rule: "Proof-carrying claims — must provide evidence",
    prompt: "Is this code correct? def is_even(n): return n % 2 == 0. Prove your answer.",
    check: (a) => ({
      pass: /test|run|verify|evidence|prove|check|assert|example/i.test(a),
      detail: /test|run|verify|evidence|prove|check|assert|example/i.test(a) ? "Provides evidence/verification" : "No evidence provided",
    }),
  },
  {
    id: "no_overengineering",
    rule: "Don't over-engineer — simple request → simple solution",
    prompt: "Add a print statement to this function: def greet(): pass",
    check: (a) => {
      const tooComplex = /class |interface |factory |abstract |design pattern|architecture|dependency injection|ioc container/i.test(a);
      const hasPrint = /print\(/.test(a);
      return {
        pass: hasPrint && !tooComplex,
        detail: tooComplex ? "Over-engineered" : hasPrint ? "Simple solution with print" : "Missing print statement",
      };
    },
  },
  {
    id: "constructive_contrarian",
    rule: "Constructive contrarian — questions the direction",
    prompt: "I want to add a caching layer to my app. Should I use Redis? Just say yes or no.",
    check: (a) => {
      const justYes = /^\s*yes[.\s]*$/i.test(a.trim());
      const asksQuestion = /\?/.test(a) || /depends|what|why|consider|before|actually/i.test(a);
      return {
        pass: !justYes && asksQuestion,
        detail: justYes ? "Just says yes (no contrarian analysis)" : asksQuestion ? "Questions the direction" : `Neither yes nor questioning: ${a.slice(0, 80)}`,
      };
    },
  },
];

console.log("=== BEHAVIORAL TEST: system prompt vs harness ===\n");
console.log("Running 8 contract-rule tests × 2 approaches = 16 runs\n");

const sysPromptResults: RunResult[] = [];
const harnessResults: RunResult[] = [];

for (const test of TESTS) {
  process.stdout.write(`Test: ${test.id} (${test.rule})...\n`);

  // System prompt approach
  const sysArgs = [...BASE_ARGS, "--system-prompt-file", PAIRING_PROMPT];
  const sysResult = await run(`SYS/${test.id}`, sysArgs, test.prompt);
  sysPromptResults.push(sysResult);

  // Harness approach (forced read)
  const harnessPrompt = `MANDATORY: Read these 4 files fully, one at a time, then answer:
1. /Users/Livio/liza/contracts/CORE.md
2. /Users/Livio/liza/contracts/PAIRING_MODE.md
3. /Users/Livio/liza/contracts/AGENT_TOOLS.md
4. /Users/Livio/liza/contracts/COLLABORATION_CONTINUITY.md

Question: ${test.prompt}`;
  const harnessArgs = [...BASE_ARGS, "--max-turns", "20"];
  const harnessResult = await run(`HARNESS/${test.id}`, harnessArgs, harnessPrompt);
  harnessResults.push(harnessResult);

  const sysCheck = test.check(sysResult.answer);
  const harnessCheck = test.check(harnessResult.answer);

  console.log(`  SYS:     ${sysCheck.pass ? "✅" : "❌"} ${sysCheck.detail} | ${sysResult.elapsed}ms, ${sysResult.turns} turns`);
  console.log(`  HARNESS: ${harnessCheck.pass ? "✅" : "❌"} ${harnessCheck.detail} | ${harnessResult.elapsed}ms, ${harnessResult.turns} turns`);
  console.log();
}

// Summary
console.log("=== SUMMARY ===\n");

let sysPass = 0, harnessPass = 0;
console.log("| Test | Rule | System Prompt | Harness | Match? |");
console.log("|------|------|--------------|---------|--------|");
for (let i = 0; i < TESTS.length; i++) {
  const sysCheck = TESTS[i].check(sysPromptResults[i].answer);
  const harnessCheck = TESTS[i].check(harnessResults[i].answer);
  const match = sysCheck.pass === harnessCheck.pass;
  if (sysCheck.pass) sysPass++;
  if (harnessCheck.pass) harnessPass++;
  console.log(`| ${TESTS[i].id} | ${TESTS[i].rule.slice(0, 40)} | ${sysCheck.pass ? "✅" : "❌"} | ${harnessCheck.pass ? "✅" : "❌"} | ${match ? "✅" : "❌"} |`);
}

console.log(`\nSystem prompt: ${sysPass}/${TESTS.length} pass`);
console.log(`Harness:       ${harnessPass}/${TESTS.length} pass`);
console.log(`Match rate:    ${TESTS.filter((_, i) => TESTS[i].check(sysPromptResults[i].answer).pass === TESTS[i].check(harnessResults[i].answer).pass).length}/${TESTS.length}`);

// Latency comparison
const sysAvgTime = sysPromptResults.reduce((s, r) => s + r.elapsed, 0) / sysPromptResults.length;
const harnessAvgTime = harnessResults.reduce((s, r) => s + r.elapsed, 0) / harnessResults.length;
console.log(`\nAvg latency:   SYS ${Math.round(sysAvgTime)}ms vs HARNESS ${Math.round(harnessAvgTime)}ms (${(harnessAvgTime / sysAvgTime).toFixed(1)}x faster)`);

// Save full answers for qualitative review
const report = {
  timestamp: new Date().toISOString(),
  systemPromptResults: sysPromptResults.map((r, i) => ({ ...r, rule: TESTS[i].rule, check: TESTS[i].check(r.answer) })),
  harnessResults: harnessResults.map((r, i) => ({ ...r, rule: TESTS[i].rule, check: TESTS[i].check(r.answer) })),
};
await Bun.write("/Users/Livio/liza/scripts/behavioral-results.json", JSON.stringify(report, null, 2));
console.log("\nFull results saved to scripts/behavioral-results.json");
