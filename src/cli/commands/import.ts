import { importExistingConfigs, writeImportedConfig } from "../../core/importer";
import { logInfo } from "../../utils/logger";

export async function runImportCommand(): Promise<void> {
  const imported = await importExistingConfigs();
  const configPath = await writeImportedConfig(imported.config);

  logInfo(`Created config: ${configPath}`);
  logInfo("Imported sources:");
  for (const source of imported.importedSources) {
    logInfo(`- ${source.client}: ${source.filePath}`);
  }
}
