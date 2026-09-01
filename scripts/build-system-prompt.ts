// Build combined system prompt files from the liza contract source.
// Preserves every word of every source file — only adds section headers.
// Source: contracts/ directory (brand-agnostic, uses §BRAND_*§ placeholders)
//
// Usage: bun run scripts/build-system-prompt.ts

import { file } from "bun";

const REPO_DIR = import.meta.dirname + "/..";
const CONTRACTS_DIR = REPO_DIR + "/contracts";
const OUT_DIR = REPO_DIR + "/prompts";

const readExact = async (path: string): Promise<string> => {
  const f = file(path);
  if (!await f.exists()) {
    console.error(`MISSING: ${path}`);
    process.exit(1);
  }
  return await f.text();
};

const HEADER = (title: string, source: string) =>
  `\n\n${"=".repeat(78)}\n# ${title}\n# Source: ${source}\n${"=".repeat(78)}\n\n`;

// ─── Pairing mode (default, no agent_id) ───
const pairingParts: Array<{ title: string; source: string; path: string }> = [
  { title: "CORE CONTRACT", source: "contracts/CORE.md", path: `${CONTRACTS_DIR}/CORE.md` },
  { title: "PAIRING MODE CONTRACT", source: "contracts/PAIRING_MODE.md", path: `${CONTRACTS_DIR}/PAIRING_MODE.md` },
  { title: "AGENT TOOLS CONTRACT", source: "contracts/AGENT_TOOLS.md", path: `${CONTRACTS_DIR}/AGENT_TOOLS.md` },
  { title: "COLLABORATION CONTINUITY", source: "contracts/COLLABORATION_CONTINUITY.md", path: `${CONTRACTS_DIR}/COLLABORATION_CONTINUITY.md` },
];

// ─── Multi-agent mode (agent_id set) ───
const multiAgentParts: Array<{ title: string; source: string; path: string }> = [
  { title: "CORE CONTRACT", source: "contracts/CORE.md", path: `${CONTRACTS_DIR}/CORE.md` },
  { title: "MULTI-AGENT MODE CONTRACT", source: "contracts/MULTI_AGENT_MODE.md", path: `${CONTRACTS_DIR}/MULTI_AGENT_MODE.md` },
  { title: "AGENT TOOLS CONTRACT", source: "contracts/AGENT_TOOLS.md", path: `${CONTRACTS_DIR}/AGENT_TOOLS.md` },
];

// ─── Subagent mode ───
const subagentParts: Array<{ title: string; source: string; path: string }> = [
  { title: "CORE CONTRACT", source: "contracts/CORE.md", path: `${CONTRACTS_DIR}/CORE.md` },
  { title: "SUBAGENT MODE CONTRACT", source: "contracts/SUBAGENT_MODE.md", path: `${CONTRACTS_DIR}/SUBAGENT_MODE.md` },
  { title: "AGENT TOOLS CONTRACT", source: "contracts/AGENT_TOOLS.md", path: `${CONTRACTS_DIR}/AGENT_TOOLS.md` },
];

const build = async (label: string, parts: Array<{ title: string; source: string; path: string }>, outPath: string) => {
  let content = `# ${label}\n\nThis file is the complete contract, combined for system-prompt delivery.\nEvery word is preserved verbatim from the source files. Section headers are added for navigation.\nProject-specific files (GUARDRAILS.md, REPOSITORY.md) are loaded separately via AGENTS.md.\n`;

  for (const part of parts) {
    const text = await readExact(part.path);
    content += HEADER(part.title, part.source);
    content += text.trimEnd();
  }

  await Bun.write(outPath, content);
  const lines = content.split("\n").length;
  const bytes = new TextEncoder().encode(content).length;
  console.log(`✅ ${label}: ${lines} lines, ${bytes} bytes → ${outPath}`);
};

await Bun.write(OUT_DIR + "/.gitkeep", "");

await build("System Prompt (Pairing Mode)", pairingParts, `${OUT_DIR}/system_prompt_pairing.md`);
await build("System Prompt (Multi-Agent Mode)", multiAgentParts, `${OUT_DIR}/system_prompt_multi_agent.md`);
await build("System Prompt (Subagent Mode)", subagentParts, `${OUT_DIR}/system_prompt_subagent.md`);

console.log("\n=== Verification: byte-level content check ===");

const verify = async (label: string, parts: Array<{ title: string; source: string; path: string }>, combinedPath: string) => {
  const combined = await readExact(combinedPath);
  let allOk = true;
  for (const part of parts) {
    const source = await readExact(part.path);
    const sourceTrimmed = source.trimEnd();
    if (!combined.includes(sourceTrimmed)) {
      console.error(`❌ ${label}: MISSING content from ${part.source}`);
      allOk = false;
    } else {
      const sourceBytes = new TextEncoder().encode(sourceTrimmed).length;
      console.log(`✅ ${label}: ${part.source} — ${sourceBytes} chars found verbatim`);
    }
  }
  return allOk;
};

const pairingOk = await verify("Pairing", pairingParts, `${OUT_DIR}/system_prompt_pairing.md`);
const multiOk = await verify("Multi-Agent", multiAgentParts, `${OUT_DIR}/system_prompt_multi_agent.md`);
const subOk = await verify("Subagent", subagentParts, `${OUT_DIR}/system_prompt_subagent.md`);

if (pairingOk && multiOk && subOk) {
  console.log("\n✅ ALL FILES VERIFIED — zero word loss");
} else {
  console.log("\n❌ VERIFICATION FAILED — some content missing");
  process.exit(1);
}
