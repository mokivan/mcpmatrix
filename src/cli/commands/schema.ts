import { logInfo } from "../../utils/logger";
import { getConfigSchemaPath, getConfigSchemaUri } from "../../utils/paths";

export function runSchemaCommand(): void {
  logInfo(`Schema path: ${getConfigSchemaPath()}`);
  logInfo(`Schema URI: ${getConfigSchemaUri()}`);
}
