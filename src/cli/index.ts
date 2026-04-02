#!/usr/bin/env node
import { Command } from "commander";
import { runApplyCommand } from "./commands/apply";
import { runImportCommand } from "./commands/import";
import { runInitCommand } from "./commands/init";
import { runPlanCommand } from "./commands/plan";
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

  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  logError(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
