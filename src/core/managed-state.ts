import fs from "fs";
import path from "path";
import type { SupportedClient } from "../types";
import { writeFileAtomic } from "../utils/backup";
import { getMcpMatrixDir, normalizeRepoPath } from "../utils/paths";

/**
 * Remembers which server names mcpmatrix wrote into each client file, so servers added by hand are never
 * removed and servers dropped from the canonical config are cleaned up.
 */
export type ManagedState = {
  version: 1;
  managed: Record<string, string[]>;
};

function getStatePath(): string {
  return path.join(getMcpMatrixDir(), "state.json");
}

function getStateKey(client: SupportedClient, filePath: string): string {
  return `${client}:${normalizeRepoPath(filePath)}`;
}

export async function loadManagedState(): Promise<ManagedState> {
  const statePath = getStatePath();
  if (!fs.existsSync(statePath)) {
    return { version: 1, managed: {} };
  }

  try {
    const parsed = JSON.parse(await fs.promises.readFile(statePath, "utf8")) as Partial<ManagedState>;
    return { version: 1, managed: parsed.managed ?? {} };
  } catch {
    // A corrupt state file only means we forget what we managed: manual servers stay untouched.
    return { version: 1, managed: {} };
  }
}

export async function saveManagedState(state: ManagedState): Promise<void> {
  await writeFileAtomic(getStatePath(), `${JSON.stringify(state, null, 2)}\n`);
}

export function getManagedNames(state: ManagedState, client: SupportedClient, filePath: string): string[] {
  return state.managed[getStateKey(client, filePath)] ?? [];
}

export function setManagedNames(state: ManagedState, client: SupportedClient, filePath: string, names: string[]): void {
  const key = getStateKey(client, filePath);
  if (names.length === 0) {
    delete state.managed[key];
    return;
  }

  state.managed[key] = [...names];
}

/** Existing entries stay, except the ones mcpmatrix wrote last time; the new managed entries win. */
export function mergeManagedEntries<T>(
  existing: Record<string, T> | undefined,
  managed: Record<string, T>,
  previouslyManaged: string[],
): Record<string, T> {
  const kept = Object.fromEntries(Object.entries(existing ?? {}).filter(([name]) => !previouslyManaged.includes(name)));
  return { ...kept, ...managed };
}
