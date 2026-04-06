import { spawnSync } from "child_process";
import { setRepoServerEnabled } from "../../core/config-editor";
import { loadConfig, writeConfig } from "../../core/config-loader";
import { runDoctor } from "../../core/doctor";
import { detectRepoPath } from "../../core/repo-detector";
import { resolveServers } from "../../core/resolver";
import { getGlobalConfigPath } from "../../utils/paths";
import type { DoctorReport } from "../../types";
import { buildTuiServerRows, createDoctorViewModel, type DoctorViewModel, type TuiContext } from "./tui-model";

export interface TuiCommandOptions {
  repo?: string;
}

interface TuiServiceDeps {
  loadConfig: typeof loadConfig;
  writeConfig: typeof writeConfig;
  runDoctor: typeof runDoctor;
  detectRepoPath: typeof detectRepoPath;
  resolveServers: typeof resolveServers;
  getGlobalConfigPath: typeof getGlobalConfigPath;
  openConfigInEditor: (configPath: string) => void;
}

const defaultDeps: TuiServiceDeps = {
  loadConfig,
  writeConfig,
  runDoctor,
  detectRepoPath,
  resolveServers,
  getGlobalConfigPath,
  openConfigInEditor,
};

export function getEditorCommand(): string {
  if (process.env.VISUAL) {
    return process.env.VISUAL;
  }

  if (process.env.EDITOR) {
    return process.env.EDITOR;
  }

  return process.platform === "win32" ? "notepad" : "vi";
}

export function openConfigInEditor(configPath: string): void {
  const editor = getEditorCommand();
  const result = spawnSync(editor, [configPath], {
    stdio: "inherit",
    shell: true,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Editor exited with status ${result.status}`);
  }
}

export function assertInteractiveTerminal(
  stdinStream: Pick<NodeJS.ReadStream, "isTTY"> = process.stdin,
  stdoutStream: Pick<NodeJS.WriteStream, "isTTY"> = process.stdout,
): void {
  if (!stdinStream.isTTY || !stdoutStream.isTTY) {
    throw new Error("mcpmatrix tui requires an interactive terminal.");
  }
}

export async function buildTuiContext(
  options?: TuiCommandOptions,
  deps: TuiServiceDeps = defaultDeps,
): Promise<TuiContext> {
  const configPath = deps.getGlobalConfigPath();
  const config = await deps.loadConfig(configPath);
  const repoDetection = options?.repo
    ? deps.detectRepoPath({ repoFlag: options.repo })
    : deps.detectRepoPath();
  const resolution = deps.resolveServers(config, repoDetection.repoPath);

  return {
    configPath,
    config,
    repoPath: resolution.repoPath,
    detectionMode: repoDetection.detectionMode,
    matchedRepo: resolution.matchedRepo,
    warnings: [...resolution.warnings],
    tags: [...resolution.tags],
    activeServers: [...resolution.servers],
    rows: buildTuiServerRows(config, resolution),
  };
}

export async function reloadTuiContext(
  options?: TuiCommandOptions,
  deps: TuiServiceDeps = defaultDeps,
): Promise<TuiContext> {
  return buildTuiContext(options, deps);
}

export async function toggleRepoServerSelection(
  context: TuiContext,
  serverName: string,
  nextEnabled: boolean,
  options?: TuiCommandOptions,
  deps: TuiServiceDeps = defaultDeps,
): Promise<TuiContext> {
  const nextConfig = setRepoServerEnabled(context.config, context.repoPath, serverName, nextEnabled);
  await deps.writeConfig(nextConfig, deps.getGlobalConfigPath());
  return buildTuiContext(options, deps);
}

export async function editConfigAndReload(
  options?: TuiCommandOptions,
  deps: TuiServiceDeps = defaultDeps,
): Promise<TuiContext> {
  deps.openConfigInEditor(deps.getGlobalConfigPath());
  return buildTuiContext(options, deps);
}

export async function loadDoctorViewModel(
  options?: TuiCommandOptions,
  deps: TuiServiceDeps = defaultDeps,
): Promise<DoctorViewModel> {
  const report = await deps.runDoctor(options);
  return createDoctorViewModel(report);
}

export async function loadDoctorReport(
  options?: TuiCommandOptions,
  deps: TuiServiceDeps = defaultDeps,
): Promise<DoctorReport> {
  return deps.runDoctor(options);
}
