import fs from "node:fs/promises";

function extractVersionNotes(changelogContent, version) {
  const lines = changelogContent.split(/\r?\n/);
  const heading = `## ${version}`;
  const startIndex = lines.findIndex((line) => line.trim() === heading);

  if (startIndex === -1) {
    throw new Error(`release: changelog section not found for version ${version}`);
  }

  const endIndex = lines.findIndex((line, index) => index > startIndex && line.startsWith("## "));
  const sectionLines = lines.slice(startIndex + 1, endIndex === -1 ? lines.length : endIndex);
  const releaseNotes = sectionLines.join("\n").trim();

  if (releaseNotes.length === 0) {
    throw new Error(`release: changelog section is empty for version ${version}`);
  }
}

async function main() {
  const packageJson = JSON.parse(await fs.readFile("package.json", "utf8"));
  const changelogContent = await fs.readFile("CHANGELOG.md", "utf8");
  extractVersionNotes(changelogContent, packageJson.version);
  console.log(`Release notes guard passed for version ${packageJson.version}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
