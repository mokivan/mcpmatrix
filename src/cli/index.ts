import { Command } from "commander";

const program = new Command();

program
  .name("mcpmatrix")
  .description("Centralized MCP configuration manager")
  .version("0.1.0");

program
  .command("plan")
  .action(() => console.log("Plan command placeholder"));

program
  .command("apply")
  .action(() => console.log("Apply command placeholder"));

program.parse();