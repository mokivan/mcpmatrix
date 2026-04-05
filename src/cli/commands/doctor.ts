import { hasDoctorErrors, runDoctor } from "../../core/doctor";
import { describeServer } from "../../core/server-config";
import { logInfo, logWarn } from "../../utils/logger";

export async function runDoctorCommand(options?: { repo?: string }): Promise<void> {
  const report = await runDoctor(options);

  logInfo(`Config: ${report.configPath}`);
  logInfo(`Repo: ${report.detectedRepoPath}`);
  logInfo(`Detection: ${report.detectionMode}`);
  logInfo(`Config matched for repo: ${report.matchedRepo ? "yes" : "no"}`);

  for (const warning of report.warnings) {
    logWarn(warning);
  }

  logInfo("Server validation:");
  for (const check of report.serverChecks) {
    if (check.runtime.transport === "stdio") {
      const commandStatus = check.runtime.exists
        ? `ok (${check.runtime.resolvedPath ?? check.runtime.command})`
        : `missing (${check.runtime.command})`;
      logInfo(`- ${check.serverName}: stdio ${commandStatus}`);
    } else {
      logInfo(`- ${check.serverName}: remote ${check.runtime.valid ? "ok" : `invalid (${check.runtime.issues.join(", ")})`}`);
    }

    if (check.missingEnvVars.length > 0) {
      logWarn(`Server ${check.serverName} is missing env vars: ${check.missingEnvVars.join(", ")}`);
    }

    for (const client of ["codex", "claude", "gemini"] as const) {
      const compatibility = check.compatibility[client];
      if (!compatibility.supported) {
        logWarn(`Server ${check.serverName} is incompatible with ${client}: ${compatibility.reason}`);
      }
    }
  }

  logInfo("Repo accessibility:");
  if (report.repoChecks.length === 0) {
    logInfo("- No repo-specific entries configured");
  } else {
    for (const check of report.repoChecks) {
      logInfo(`- ${check.repoPath}: ${check.accessible ? "ok" : "missing or inaccessible"}`);
    }
  }

  logInfo("Active servers for detected repo:");
  if (report.activeServers.length === 0) {
    logInfo("- (none)");
  } else {
    for (const server of report.activeServers) {
      logInfo(`- ${describeServer(server)}`);
    }
  }

  logInfo("Suggested tags:");
  if (report.suggestedTags.length === 0) {
    logInfo("- (none)");
  } else {
    for (const suggestion of report.suggestedTags) {
      logInfo(`- ${suggestion.tag} (from ${suggestion.evidence})`);
    }
  }

  if (hasDoctorErrors(report)) {
    throw new Error("Doctor found issues.");
  }

  logInfo("Doctor checks passed.");
}
