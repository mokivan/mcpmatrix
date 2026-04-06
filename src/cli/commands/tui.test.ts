import { describe, expect, it, vi } from "vitest";
import { runTuiCommandWithDeps } from "./tui";

describe("runTuiCommandWithDeps", () => {
  it("fails before building the app when terminal is not interactive", async () => {
    const assertInteractiveTerminal = vi.fn(() => {
      throw new Error("mcpmatrix tui requires an interactive terminal.");
    });
    const buildTuiContext = vi.fn();

    await expect(
      runTuiCommandWithDeps(
        undefined,
        {
          assertInteractiveTerminal,
          buildTuiContext,
          editConfigAndReload: vi.fn(),
          loadDoctorViewModel: vi.fn(),
          toggleRepoServerSelection: vi.fn(),
          terminal: {} as never,
        },
      ),
    ).rejects.toThrow("mcpmatrix tui requires an interactive terminal.");

    expect(assertInteractiveTerminal).toHaveBeenCalledOnce();
    expect(buildTuiContext).not.toHaveBeenCalled();
  });
});
