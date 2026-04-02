import { loadConfig } from "../../core/config-loader";
import { validateExecutableCommands } from "../../core/config-validator";
import { logInfo } from "../../utils/logger";
import { getGlobalConfigPath } from "../../utils/paths";

export async function runValidateCommand(): Promise<void> {
  const configPath = getGlobalConfigPath();
  const config = await loadConfig(configPath);
  validateExecutableCommands(config);

  logInfo(`Configuration valid: ${configPath}`);
}
