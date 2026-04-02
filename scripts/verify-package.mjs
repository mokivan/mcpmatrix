import { execFileSync } from "node:child_process";

function getNpmCliInvocation() {
  const npmExecPath = process.env.npm_execpath;
  if (!npmExecPath) {
    throw new Error("package: npm_execpath is not available");
  }

  return {
    command: process.execPath,
    args: [npmExecPath, "pack", "--dry-run", "--json"],
  };
}

function fail(message) {
  throw new Error(`package: ${message}`);
}

function runPackDryRun() {
  const npmCli = getNpmCliInvocation();
  const rawOutput = execFileSync(npmCli.command, npmCli.args, {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  const parsedOutput = JSON.parse(rawOutput);
  if (!Array.isArray(parsedOutput) || parsedOutput.length !== 1) {
    fail("unexpected npm pack output");
  }

  return parsedOutput[0];
}

function main() {
  const packResult = runPackDryRun();
  const filePaths = new Set(
    Array.isArray(packResult.files) ? packResult.files.map((entry) => entry.path).filter((entry) => typeof entry === "string") : [],
  );

  for (const requiredPath of ["LICENSE", "README.md", "package.json", "dist/cli/index.js"]) {
    if (!filePaths.has(requiredPath)) {
      fail(`missing expected tarball entry: ${requiredPath}`);
    }
  }

  for (const forbiddenPrefix of [".github/", "docs/", "scripts/", "src/"]) {
    for (const filePath of filePaths) {
      if (filePath.startsWith(forbiddenPrefix)) {
        fail(`unexpected tarball entry: ${filePath}`);
      }
    }
  }
}

main();
