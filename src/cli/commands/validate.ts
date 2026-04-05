import { loadConfig } from "../../core/config-loader";
import { validateServerDefinitions } from "../../core/config-validator";
import { logInfo } from "../../utils/logger";
import { getGlobalConfigPath } from "../../utils/paths";

export async function runValidateCommand(): Promise<void> {
  const configPath = getGlobalConfigPath();
  const config = await loadConfig(configPath);
  validateServerDefinitions(config);

  logInfo(`Validated ${Object.keys(config.servers).length} server definition(s).`);
  logInfo(`Configuration valid: ${configPath}`);
}
