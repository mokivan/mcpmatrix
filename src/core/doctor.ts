import fs from "fs";
import { loadConfig } from "./config-loader";
import { getServerDoctorChecks } from "./config-validator";
import { detectRepoPath } from "./repo-detector";
import { resolveServers } from "./resolver";
import { suggestTagsFromRepo } from "./stack-detector";
import type { DoctorReport, RepoAccessibilityCheck } from "../types";
import { getGlobalConfigPath } from "../utils/paths";

function getRepoChecks(repoPaths: string[]): RepoAccessibilityCheck[] {
  return repoPaths.map((repoPath) => {
    try {
      return {
        repoPath,
        accessible: fs.existsSync(repoPath),
      };
    } catch {
      return {
        repoPath,
        accessible: false,
      };
    }
  });
}

export async function runDoctor(options?: { repo?: string }): Promise<DoctorReport> {
  const configPath = getGlobalConfigPath();
  const config = await loadConfig(configPath);
  const repoDetection = options?.repo
    ? detectRepoPath({ repoFlag: options.repo })
    : detectRepoPath();
  const resolution = resolveServers(config, repoDetection.repoPath);

  return {
    configPath,
    detectedRepoPath: repoDetection.repoPath,
    detectionMode: repoDetection.detectionMode,
    matchedRepo: resolution.matchedRepo,
    warnings: [...resolution.warnings],
    activeServers: resolution.servers,
    serverChecks: getServerDoctorChecks(config),
    repoChecks: getRepoChecks(Object.keys(config.scopes?.repos ?? {})),
    suggestedTags: suggestTagsFromRepo(repoDetection.repoPath),
  };
}

export function hasDoctorErrors(report: DoctorReport): boolean {
  return (
    report.serverChecks.some((check) => !check.command.exists || check.missingEnvVars.length > 0) ||
    report.repoChecks.some((check) => !check.accessible)
  );
}
