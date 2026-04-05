#!/usr/bin/env node
import { Command } from "commander";
import { runApplyCommand } from "./commands/apply";
import { runListBackupsCommand } from "./commands/backups";
import { runDoctorCommand } from "./commands/doctor";
import { runImportCommand } from "./commands/import";
import { runInitCommand } from "./commands/init";
import { runPlanCommand } from "./commands/plan";
import { runRollbackCommand } from "./commands/rollback";
import { runSchemaCommand } from "./commands/schema";
import { runTuiCommand } from "./commands/tui";
import { runValidateCommand } from "./commands/validate";
import { logError } from "../utils/logger";
import { getPackageVersion } from "../utils/package-metadata";

async function main(): Promise<void> {
  const program = new Command();

  program.name("mcpmatrix").description("Centralized MCP configuration manager").version(getPackageVersion());

  program.command("init").description("Create the initial ~/.mcpmatrix/config.yml file").action(async () => {
    await runInitCommand();
  });

  program
    .command("import")
    .description("Import existing client MCP configs into ~/.mcpmatrix/config.yml")
    .action(async () => {
      await runImportCommand();
    });

  program
    .command("schema")
    .description("Print the local JSON Schema path and URI for ~/.mcpmatrix/config.yml")
    .action(() => {
      runSchemaCommand();
    });

  const backupsCommand = program
    .command("backups")
    .description("Inspect versioned client config backups");

  backupsCommand
    .command("list")
    .description("List detected backups under ~/.mcpmatrix/backups/")
    .option("--client <client>", "Filter backups by client")
    .action(async (options: { client?: "codex" | "claude" | "gemini" }) => {
      await runListBackupsCommand(options);
    });

  program
    .command("plan")
    .description("Resolve active MCP servers and show planned config updates")
    .option("--repo <path>", "Override the detected repository path")
    .action(async (options: { repo?: string }) => {
      await runPlanCommand(options);
    });

  program
    .command("apply")
    .description("Resolve active MCP servers and update client config files")
    .option("--repo <path>", "Override the detected repository path")
    .action(async (options: { repo?: string }) => {
      await runApplyCommand(options);
    });

  program
    .command("validate")
    .description("Validate ~/.mcpmatrix/config.yml and referenced MCP commands")
    .action(async () => {
      await runValidateCommand();
    });

  program
    .command("doctor")
    .description("Run diagnostics for MCP commands, env vars, config consistency, and repos")
    .option("--repo <path>", "Override the detected repository path")
    .action(async (options: { repo?: string }) => {
      await runDoctorCommand(options);
    });

  program
    .command("rollback")
    .description("Restore the latest backup globally or for a single client")
    .option("--client <client>", "Restore only one client config")
    .option("--backup <backup>", "Restore a specific backup file by name or path")
    .action(async (options: { client?: "codex" | "claude" | "gemini"; backup?: string }) => {
      await runRollbackCommand(options);
    });

  program
    .command("tui")
    .description("Open the interactive terminal UI")
    .option("--repo <path>", "Override the detected repository path")
    .action(async (options: { repo?: string }) => {
      await runTuiCommand(options);
    });

  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  logError(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
