import os from "os";
import path from "path";

export function getGlobalConfigPath(){
  return path.join(os.homedir(),".mcpmatrix","config.yml");
}