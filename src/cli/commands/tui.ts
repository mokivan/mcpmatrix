import { spawnSync } from "child_process";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { setRepoServerEnabled } from "../../core/config-editor";
import { loadConfig, writeConfig } from "../../core/config-loader";
import { runDoctor } from "../../core/doctor";
import { detectRepoPath } from "../../core/repo-detector";
import { resolveServers } from "../../core/resolver";
import { describeServer } from "../../core/server-config";
import type { McpMatrixConfig } from "../../types";
import { getGlobalConfigPath } from "../../utils/paths";

interface TuiContext {
  config: McpMatrixConfig;
  repoPath: string;
  detectionMode: "flag" | "git" | "cwd";
}

function clearScreen(): void {
  if (output.isTTY) {
    output.write("\u001b[2J\u001b[0f");
  }
}

function getEditorCommand(): string {
  if (process.env.VISUAL) {
    return process.env.VISUAL;
  }

  if (process.env.EDITOR) {
    return process.env.EDITOR;
  }

  return process.platform === "win32" ? "notepad" : "vi";
}

function openConfigInEditor(configPath: string): void {
  const editor = getEditorCommand();
  const result = spawnSync(editor, [configPath], {
    stdio: "inherit",
    shell: true,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Editor exited with status ${result.status}`);
  }
}

function assertInteractiveTerminal(): void {
  if (!input.isTTY || !output.isTTY) {
    throw new Error("mcpmatrix tui requires an interactive terminal.");
  }
}

async function buildContext(options?: { repo?: string }): Promise<TuiContext> {
  const config = await loadConfig();
  const repoDetection = options?.repo
    ? detectRepoPath({ repoFlag: options.repo })
    : detectRepoPath();

  return {
    config,
    repoPath: repoDetection.repoPath,
    detectionMode: repoDetection.detectionMode,
  };
}

function renderStatus(context: TuiContext): string {
  const resolution = resolveServers(context.config, context.repoPath);
  const repoScope = context.config.scopes?.repos?.[context.repoPath];
  const repoEnabled = new Set(repoScope?.enable ?? []);
  const suggestedTagNames = new Set((repoScope?.tags ?? []).filter(Boolean));
  const lines = [
    "mcpmatrix TUI",
    "",
    `Repo: ${context.repoPath}`,
    `Detection: ${context.detectionMode}`,
    `Configured repo entry: ${resolution.matchedRepo ? "yes" : "no"}`,
    `Repo tags: ${resolution.tags.length > 0 ? resolution.tags.join(", ") : "(none)"}`,
    "",
    "Active servers:",
  ];

  if (resolution.servers.length === 0) {
    lines.push("- (none)");
  } else {
    for (const server of resolution.servers) {
      const source = repoEnabled.has(server.name) ? "repo" : "inherited";
      lines.push(`- ${source}: ${describeServer(server)}`);
    }
  }

  lines.push("");
  lines.push("Available actions:");
  lines.push("1. Toggle repo-local servers");
  lines.push("2. Inspect doctor report");
  lines.push("3. Edit config in $EDITOR");
  lines.push("4. Refresh");
  lines.push("5. Quit");

  if (suggestedTagNames.size > 0) {
    lines.push("");
    lines.push(`Current repo tags are declared in config: ${[...suggestedTagNames].join(", ")}`);
  }

  return lines.join("\n");
}

async function inspectDoctorReport(options: { repo?: string } | undefined): Promise<void> {
  const report = await runDoctor(options);
  const lines = [
    "",
    "Doctor report",
    `- Matched repo config: ${report.matchedRepo ? "yes" : "no"}`,
    `- Active servers: ${report.activeServers.map((server) => server.name).join(", ") || "(none)"}`,
    `- Suggested tags: ${report.suggestedTags.map((entry) => entry.tag).join(", ") || "(none)"}`,
  ];

  for (const check of report.serverChecks) {
    if (check.runtime.transport === "stdio") {
      lines.push(`- ${check.serverName}: stdio ${check.runtime.exists ? "ok" : "missing"}`);
    } else {
      lines.push(`- ${check.serverName}: remote ${check.runtime.valid ? "ok" : "invalid"}`);
    }
    if (check.missingEnvVars.length > 0) {
      lines.push(`  missing env: ${check.missingEnvVars.join(", ")}`);
    }
  }

  for (const repoCheck of report.repoChecks) {
    lines.push(`- repo ${repoCheck.repoPath}: ${repoCheck.accessible ? "ok" : "missing"}`);
  }

  console.log(lines.join("\n"));
}

async function toggleRepoServers(
  rl: readline.Interface,
  context: TuiContext,
): Promise<TuiContext> {
  const resolution = resolveServers(context.config, context.repoPath);
  const repoScope = context.config.scopes?.repos?.[context.repoPath];
  const repoEnabled = new Set(repoScope?.enable ?? []);
  const activeServers = new Set(resolution.servers.map((server) => server.name));
  const allServers = Object.keys(context.config.servers).sort((left, right) => left.localeCompare(right));

  console.log("");
  console.log("Repo-local server toggles");
  console.log("Inherited active servers cannot be disabled because the canonical schema is additive only.");

  allServers.forEach((serverName, index) => {
    const isRepoEnabled = repoEnabled.has(serverName);
    const isActive = activeServers.has(serverName);
    const status = isRepoEnabled
      ? "active via repo"
      : isActive
        ? "active via global/tag (locked)"
        : "inactive";
    console.log(`${index + 1}. ${serverName} - ${status}`);
  });

  const answer = await rl.question("Select a server number to toggle, or press Enter to cancel: ");
  if (answer.trim() === "") {
    return context;
  }

  const selectedIndex = Number.parseInt(answer, 10);
  if (!Number.isInteger(selectedIndex) || selectedIndex < 1 || selectedIndex > allServers.length) {
    console.log("Invalid selection.");
    return context;
  }

  const serverName = allServers[selectedIndex - 1];
  if (!serverName) {
    console.log("Invalid selection.");
    return context;
  }

  if (!repoEnabled.has(serverName) && activeServers.has(serverName)) {
    console.log("That server is inherited from global/tag scope and cannot be disabled here.");
    return context;
  }

  const nextConfig = setRepoServerEnabled(context.config, context.repoPath, serverName, !repoEnabled.has(serverName));
  await writeConfig(nextConfig, getGlobalConfigPath());
  console.log(`Updated repo-local enable list for ${serverName}.`);

  return {
    ...context,
    config: nextConfig,
  };
}

export async function runTuiCommand(options?: { repo?: string }): Promise<void> {
  assertInteractiveTerminal();
  const rl = readline.createInterface({ input, output });

  try {
    let context = await buildContext(options);

    while (true) {
      clearScreen();
      console.log(renderStatus(context));
      console.log("");
      const answer = await rl.question("Choose an action: ");

      if (answer === "1") {
        context = await toggleRepoServers(rl, context);
        await rl.question("Press Enter to continue...");
        continue;
      }

      if (answer === "2") {
        await inspectDoctorReport(options);
        await rl.question("Press Enter to continue...");
        continue;
      }

      if (answer === "3") {
        openConfigInEditor(getGlobalConfigPath());
        context = await buildContext(options);
        continue;
      }

      if (answer === "4") {
        context = await buildContext(options);
        continue;
      }

      if (answer === "5") {
        return;
      }

      console.log("Unknown action.");
      await rl.question("Press Enter to continue...");
    }
  } finally {
    rl.close();
  }
}
