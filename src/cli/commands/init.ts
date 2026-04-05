import { writeInitialConfig } from "../../core/config-loader";
import { logInfo } from "../../utils/logger";
import { getGlobalConfigPath } from "../../utils/paths";

export async function runInitCommand(): Promise<void> {
  const configPath = getGlobalConfigPath();
  await writeInitialConfig(configPath);
  logInfo(`Created config: ${configPath}`);
  logInfo("Editor schema support enabled via yaml-language-server header.");
}
