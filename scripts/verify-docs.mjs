import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const cliPath = path.join(repoRoot, "src", "cli", "index.ts");
const readmePath = path.join(repoRoot, "README.md");
const specCliPath = path.join(repoRoot, "docs", "specs", "spec-cli.md");

function extractCommands(cliSource) {
  const commands = [];
  const topLevelPattern = /program\s*\.\s*command\("([^"]+)"\)/g;
  const nestedPattern = /(\w+)\s*\.\s*command\("([^"]+)"\)/g;
  let match;

  while ((match = topLevelPattern.exec(cliSource)) !== null) {
    commands.push(match[1]);
  }

  while ((match = nestedPattern.exec(cliSource)) !== null) {
    const [, parentVar, childCommand] = match;
    if (parentVar === "program") {
      continue;
    }

    if (parentVar === "backupsCommand") {
      commands.push(`backups ${childCommand}`);
    }
  }

  return [...new Set(commands)].sort();
}

function assertCommandDocs(documentPath, documentContents, commands) {
  const missingCommands = commands.filter((command) => !documentContents.includes(`mcpmatrix ${command}`));

  if (missingCommands.length > 0) {
    throw new Error(
      `Missing CLI documentation in ${path.relative(repoRoot, documentPath)} for command(s): ${missingCommands.join(", ")}`,
    );
  }
}

async function main() {
  const [cliSource, readme, specCli] = await Promise.all([
    fs.readFile(cliPath, "utf8"),
    fs.readFile(readmePath, "utf8"),
    fs.readFile(specCliPath, "utf8"),
  ]);

  const commands = extractCommands(cliSource);
  assertCommandDocs(readmePath, readme, commands);
  assertCommandDocs(specCliPath, specCli, commands);

  console.log(`Documentation guard passed for ${commands.length} CLI command(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
