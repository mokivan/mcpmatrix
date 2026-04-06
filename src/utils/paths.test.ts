import os from "os";
import path from "path";
import { describe, expect, it, vi } from "vitest";
import {
  getCopilotCliConfigPath,
  getCopilotVsCodeConfigPath,
  getRepoCopilotCliConfigPath,
  getRepoCopilotVsCodeConfigPath,
  normalizeRepoPath,
} from "./paths";

describe("normalizeRepoPath", () => {
  it("normalizes Windows-style paths consistently", () => {
    expect(normalizeRepoPath("C:\\Users\\Ivan\\repo\\.\\sub\\..")).toBe("c:\\users\\ivan\\repo");
  });

  it("normalizes POSIX-style paths consistently", () => {
    expect(normalizeRepoPath("/Users/ivan/repo/./nested/..")).toBe("/Users/ivan/repo");
  });

  it("resolves relative paths from the current working directory", () => {
    expect(normalizeRepoPath(".")).toBe(normalizeRepoPath(process.cwd()));
  });

  it("returns the expected copilot repo-scoped config paths", () => {
    expect(getRepoCopilotCliConfigPath("/repo")).toBe(path.join("/repo", ".github", "mcp.json"));
    expect(getRepoCopilotVsCodeConfigPath("/repo")).toBe(path.join("/repo", ".vscode", "mcp.json"));
  });

  it("returns the expected global copilot config paths on windows", () => {
    const platformSpy = vi.spyOn(process, "platform", "get").mockReturnValue("win32");
    const originalAppData = process.env.APPDATA;
    process.env.APPDATA = "C:\\Users\\ivan_\\AppData\\Roaming";

    expect(getCopilotCliConfigPath()).toBe(path.join(os.homedir(), ".copilot", "mcp-config.json"));
    expect(getCopilotVsCodeConfigPath()).toBe(path.join("C:\\Users\\ivan_\\AppData\\Roaming", "Code", "User", "mcp.json"));

    platformSpy.mockRestore();
    process.env.APPDATA = originalAppData;
  });
});
