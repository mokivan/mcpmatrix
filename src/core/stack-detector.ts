import fs from "fs";
import path from "path";
import type { StackTagSuggestion } from "../types";

function fileExists(candidatePath: string): boolean {
  try {
    return fs.existsSync(candidatePath);
  } catch {
    return false;
  }
}

function findCsproj(repoPath: string): string | null {
  const queue = [repoPath];

  while (queue.length > 0) {
    const currentPath = queue.shift();
    if (!currentPath) {
      continue;
    }

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isFile() && entry.name.endsWith(".csproj")) {
        return fullPath;
      }

      if (entry.isDirectory() && entry.name !== ".git" && entry.name !== "node_modules") {
        queue.push(fullPath);
      }
    }
  }

  return null;
}

export function suggestTagsFromRepo(repoPath: string): StackTagSuggestion[] {
  const suggestions: StackTagSuggestion[] = [];
  const packageJsonPath = path.join(repoPath, "package.json");
  const pomXmlPath = path.join(repoPath, "pom.xml");
  const csprojPath = findCsproj(repoPath);

  if (fileExists(packageJsonPath)) {
    suggestions.push({ tag: "node", evidence: packageJsonPath });
  }

  if (fileExists(pomXmlPath)) {
    suggestions.push({ tag: "java", evidence: pomXmlPath });
  }

  if (csprojPath) {
    suggestions.push({ tag: "dotnet", evidence: csprojPath });
  }

  return suggestions;
}
