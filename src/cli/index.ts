#!/usr/bin/env node
import { Command } from "commander";
import { runApplyCommand } from "./commands/apply";
import { runInitCommand } from "./commands/init";
import { runPlanCommand } from "./commands/plan";
import { logError } from "../utils/logger";

async function main(): Promise<void> {
  const program = new Command();

  program.name("mcpmatrix").description("Centralized MCP configuration manager").version("0.1.0");

  program.command("init").description("Create the initial ~/.mcpmatrix/config.yml file").action(async () => {
    await runInitCommand();
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

  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  logError(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
