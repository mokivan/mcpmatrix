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

  return sectionLines.join("\n").trim();
}

async function main() {
  const [version, outputPath] = process.argv.slice(2);
  if (!version || !outputPath) {
    throw new Error("release: usage: node scripts/release-notes.mjs <version> <output-path>");
  }

  const changelogContent = await fs.readFile("CHANGELOG.md", "utf8");
  const releaseNotes = extractVersionNotes(changelogContent, version);
  await fs.writeFile(outputPath, releaseNotes.endsWith("\n") ? releaseNotes : `${releaseNotes}\n`, "utf8");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
