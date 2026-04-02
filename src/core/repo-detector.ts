import fs from "fs";
import path from "path";
import type { RepoDetectionResult } from "../types";
import { normalizeRepoPath } from "../utils/paths";

function hasGitMarker(candidatePath: string): boolean {
  return fs.existsSync(path.join(candidatePath, ".git"));
}

function findGitRoot(startPath: string): string | null {
  let currentPath = path.resolve(startPath);

  while (true) {
    if (hasGitMarker(currentPath)) {
      return currentPath;
    }

    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      return null;
    }

    currentPath = parentPath;
  }
}

export function detectRepoPath(options?: { cwd?: string; repoFlag?: string }): RepoDetectionResult {
  const cwd = normalizeRepoPath(options?.cwd ?? process.cwd());

  if (options?.repoFlag) {
    return {
      cwd,
      repoPath: normalizeRepoPath(options.repoFlag),
      detectionMode: "flag",
    };
  }

  const gitRoot = findGitRoot(cwd);
  if (gitRoot) {
    return {
      cwd,
      repoPath: normalizeRepoPath(gitRoot),
      detectionMode: "git",
    };
  }

  return {
    cwd,
    repoPath: cwd,
    detectionMode: "cwd",
  };
}
