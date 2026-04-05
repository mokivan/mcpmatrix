import terminalKit = require("terminal-kit");
import {
  assertInteractiveTerminal,
  buildTuiContext,
  editConfigAndReload,
  loadDoctorViewModel,
  toggleRepoServerSelection,
  type TuiCommandOptions,
} from "./tui-service";
import {
  canToggleServerRow,
  createInitialTuiState,
  filterTuiServerRows,
  getSelectedRow,
  moveSelection,
  setFilter,
  syncStateWithRows,
  type DoctorViewModel,
  type TuiContext,
  type TuiServerRow,
  type TuiSeverity,
  type TuiState,
  type TuiStatusMessage,
} from "./tui-model";

interface TuiCommandDeps {
  assertInteractiveTerminal: typeof assertInteractiveTerminal;
  buildTuiContext: typeof buildTuiContext;
  editConfigAndReload: typeof editConfigAndReload;
  loadDoctorViewModel: typeof loadDoctorViewModel;
  toggleRepoServerSelection: typeof toggleRepoServerSelection;
  terminal: typeof terminalKit.terminal;
}

const defaultDeps: TuiCommandDeps = {
  assertInteractiveTerminal,
  buildTuiContext,
  editConfigAndReload,
  loadDoctorViewModel,
  toggleRepoServerSelection,
  terminal: terminalKit.terminal,
};

function truncateText(value: string, width: number): string {
  if (width <= 0) {
    return "";
  }

  if (value.length <= width) {
    return value.padEnd(width, " ");
  }

  if (width <= 3) {
    return value.slice(0, width);
  }

  return `${value.slice(0, width - 3)}...`;
}

function wrapText(value: string, width: number): string[] {
  if (width <= 0) {
    return [];
  }

  const normalized = value.trim();
  if (normalized === "") {
    return [""];
  }

  const words = normalized.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (word.length > width) {
      if (currentLine !== "") {
        lines.push(currentLine);
        currentLine = "";
      }

      for (let index = 0; index < word.length; index += width) {
        lines.push(word.slice(index, index + width));
      }
      continue;
    }

    const candidate = currentLine === "" ? word : `${currentLine} ${word}`;
    if (candidate.length <= width) {
      currentLine = candidate;
      continue;
    }

    lines.push(currentLine);
    currentLine = word;
  }

  if (currentLine !== "") {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [""];
}

function getSeverityLabel(severity: TuiSeverity): string {
  if (severity === "ok") {
    return "ok";
  }

  if (severity === "warning") {
    return "warning";
  }

  if (severity === "error") {
    return "error";
  }

  return "info";
}

function getRowIndicator(row: TuiServerRow): string {
  if (row.source === "repo") {
    return "[repo]";
  }

  if (row.source === "inherited") {
    return "[lock]";
  }

  return "[off ]";
}

function getRowStatusText(row: TuiServerRow): string {
  if (row.source === "repo") {
    return "Active via repo scope";
  }

  if (row.source === "inherited") {
    return "Active via global or tag scope";
  }

  return "Inactive";
}

function getVisibleRows(context: TuiContext, state: TuiState): TuiServerRow[] {
  return filterTuiServerRows(context.rows, state.filter);
}

function createStatusMessage(tone: TuiSeverity, text: string): TuiStatusMessage {
  return { tone, text };
}

function renderHeader(term: typeof terminalKit.terminal, context: TuiContext, width: number): void {
  term.moveTo(1, 1);
  term.bold.brightWhite(truncateText("mcpmatrix TUI", width));
  term.moveTo(1, 2);
  term.brightBlack(
    truncateText(
      `Repo: ${context.repoPath} | detection: ${context.detectionMode} | configured: ${context.matchedRepo ? "yes" : "no"}`,
      width,
    ),
  );
  term.moveTo(1, 3);
  term.brightBlack(truncateText(`Tags: ${context.tags.join(", ") || "(none)"}`, width));
}

function renderListPanel(
  term: typeof terminalKit.terminal,
  rows: readonly TuiServerRow[],
  state: TuiState,
  leftWidth: number,
  top: number,
  bottom: number,
): void {
  term.moveTo(1, top);
  term.bold("Servers");

  if (rows.length === 0) {
    term.moveTo(1, top + 1);
    term.yellow(truncateText(`No servers match filter "${state.filter}".`, leftWidth));
    return;
  }

  const maxVisibleRows = Math.max(1, bottom - top);
  const selectedIndex = Math.min(state.selectedIndex, rows.length - 1);
  const startIndex = Math.max(0, Math.min(selectedIndex - Math.floor(maxVisibleRows / 2), rows.length - maxVisibleRows));

  for (let offset = 0; offset < maxVisibleRows; offset += 1) {
    const row = rows[startIndex + offset];
    const y = top + 1 + offset;
    if (!row || y > bottom) {
      break;
    }

    const prefix = startIndex + offset === selectedIndex ? ">" : " ";
    const label = truncateText(`${prefix} ${getRowIndicator(row)} ${row.name}`, leftWidth);
    term.moveTo(1, y);

    if (startIndex + offset === selectedIndex) {
      term.black.bgCyan(label);
      term.styleReset();
      continue;
    }

    if (row.source === "repo") {
      term.green(label);
      continue;
    }

    if (row.source === "inherited") {
      term.yellow(label);
      continue;
    }

    term.white(label);
  }
}

function renderDetailPanel(
  term: typeof terminalKit.terminal,
  selectedRow: TuiServerRow | null,
  context: TuiContext,
  x: number,
  width: number,
  top: number,
  bottom: number,
): void {
  term.moveTo(x, top);
  term.bold("Details");

  const lines: string[] = [];

  if (!selectedRow) {
    lines.push("No server selected.");
  } else {
    lines.push(`Name: ${selectedRow.name}`);
    lines.push(`Status: ${getRowStatusText(selectedRow)}`);
    lines.push(`Transport: ${selectedRow.transportLabel}`);
    lines.push(`Definition: ${selectedRow.commandText || "(none)"}`);
    lines.push(`Env refs: ${selectedRow.envVarNames.join(", ") || "(none)"}`);
    lines.push(`Repo tags: ${context.tags.join(", ") || "(none)"}`);
    lines.push(selectedRow.isLocked ? "Toggle: locked by additive scope rules" : "Toggle: allowed from this view");
  }

  let currentY = top + 1;
  for (const line of lines) {
    for (const wrappedLine of wrapText(line, width)) {
      if (currentY > bottom) {
        return;
      }
      term.moveTo(x, currentY);
      term.white(truncateText(wrappedLine, width));
      currentY += 1;
    }
  }
}

function renderDoctorView(
  term: typeof terminalKit.terminal,
  doctorView: DoctorViewModel | null,
  width: number,
  height: number,
): void {
  term.moveTo(1, 1);
  term.bold.brightWhite("Doctor report");

  if (!doctorView) {
    term.moveTo(1, 3);
    term.yellow("Doctor report is loading...");
    return;
  }

  const lines: Array<{ severity: TuiSeverity; text: string }> = [];
  lines.push({ severity: "info", text: "Summary" });
  for (const item of doctorView.summary) {
    lines.push({ severity: item.severity, text: `${item.label}: ${item.detail}` });
  }

  if (doctorView.warnings.length > 0) {
    lines.push({ severity: "info", text: "Warnings" });
    for (const item of doctorView.warnings) {
      lines.push({ severity: item.severity, text: `${item.label}: ${item.detail}` });
    }
  }

  lines.push({ severity: "info", text: "Server checks" });
  for (const item of doctorView.serverChecks) {
    lines.push({ severity: item.severity, text: `${item.label}: ${item.detail}` });
  }

  lines.push({ severity: "info", text: "Repo checks" });
  if (doctorView.repoChecks.length === 0) {
    lines.push({ severity: "info", text: "(none)" });
  } else {
    for (const item of doctorView.repoChecks) {
      lines.push({ severity: item.severity, text: `${item.label}: ${item.detail}` });
    }
  }

  lines.push({ severity: "info", text: "Suggested tags" });
  if (doctorView.suggestedTags.length === 0) {
    lines.push({ severity: "info", text: "(none)" });
  } else {
    for (const item of doctorView.suggestedTags) {
      lines.push({ severity: item.severity, text: `${item.label}: ${item.detail}` });
    }
  }

  const maxLines = Math.max(1, height - 3);
  for (let index = 0; index < Math.min(lines.length, maxLines); index += 1) {
    const line = lines[index];
    if (!line) {
      break;
    }
    const y = index + 3;
    const content = truncateText(`${getSeverityLabel(line.severity)} | ${line.text}`, width);
    term.moveTo(1, y);

    if (line.severity === "error") {
      term.red(content);
      continue;
    }

    if (line.severity === "warning") {
      term.yellow(content);
      continue;
    }

    if (line.severity === "ok") {
      term.green(content);
      continue;
    }

    term.white(content);
  }
}

function renderFooter(term: typeof terminalKit.terminal, state: TuiState, width: number, height: number): void {
  term.moveTo(1, height - 1);
  term.brightBlack(
    truncateText(
      "Arrows move | Enter/Space toggle | / filter | d doctor | e editor | r refresh | q quit",
      width,
    ),
  );

  const status = state.statusMessage
    ? `${getSeverityLabel(state.statusMessage.tone)}: ${state.statusMessage.text}`
    : state.filter
      ? `filter: ${state.filter}`
      : "Ready";

  term.moveTo(1, height);
  const content = truncateText(status, width);

  if (!state.statusMessage) {
    term.white(content);
    return;
  }

  if (state.statusMessage.tone === "error") {
    term.red(content);
    return;
  }

  if (state.statusMessage.tone === "warning") {
    term.yellow(content);
    return;
  }

  if (state.statusMessage.tone === "ok") {
    term.green(content);
    return;
  }

  term.white(content);
}

function renderApp(
  term: typeof terminalKit.terminal,
  context: TuiContext,
  state: TuiState,
  doctorView: DoctorViewModel | null,
): void {
  term.eraseDisplay();

  const width = Math.max(40, term.width);
  const height = Math.max(12, term.height);
  renderHeader(term, context, width);

  if (state.view === "doctor") {
    renderDoctorView(term, doctorView, width, height - 2);
    renderFooter(term, state, width, height);
    return;
  }

  const visibleRows = getVisibleRows(context, state);
  const selectedRow = getSelectedRow(visibleRows, state.selectedIndex);
  const leftWidth = Math.max(28, Math.floor(width * 0.42));
  const rightX = leftWidth + 3;
  const rightWidth = Math.max(20, width - rightX + 1);
  const top = 5;
  const bottom = height - 3;

  renderListPanel(term, visibleRows, state, leftWidth, top, bottom);
  renderDetailPanel(term, selectedRow, context, rightX, rightWidth, top, bottom);
  renderFooter(term, state, width, height);
}

async function promptForFilter(term: typeof terminalKit.terminal, currentFilter: string): Promise<string | null> {
  term.moveTo(1, term.height);
  term.eraseLine();
  term.bold.white(`/ Filter (${currentFilter || "empty"}): `);

  const result = await term.inputField({
    cancelable: true,
    default: currentFilter,
  }).promise;

  if (typeof result !== "string") {
    return null;
  }

  return result.trim();
}

async function runTuiSession(
  initialContext: TuiContext,
  options: TuiCommandOptions | undefined,
  deps: TuiCommandDeps,
): Promise<void> {
  const term = deps.terminal;
  let context = initialContext;
  let state = syncStateWithRows(createInitialTuiState(), context.rows);
  let doctorView: DoctorViewModel | null = null;
  let resolveClose: (() => void) | null = null;
  let isClosed = false;
  let actionChain = Promise.resolve();

  const rerender = (): void => {
    const visibleRows = getVisibleRows(context, state);
    state = syncStateWithRows(state, visibleRows);
    renderApp(term, context, state, doctorView);
  };

  const onResize = (): void => {
    rerender();
  };

  const cleanup = async (): Promise<void> => {
    term.removeListener("key", onKey);
    term.removeListener("resize", onResize);
    term.grabInput(false);
    term.fullscreen(false);
    await term.asyncCleanup();
  };

  const close = async (): Promise<void> => {
    if (isClosed) {
      return;
    }

    isClosed = true;
    await cleanup();
    resolveClose?.();
  };

  const suspendTerminal = async (): Promise<void> => {
    term.removeListener("key", onKey);
    term.removeListener("resize", onResize);
    term.grabInput(false);
    term.fullscreen(false);
    await term.asyncCleanup();
  };

  const resumeTerminal = (): void => {
    term.fullscreen(true);
    term.grabInput({ safe: true });
    term.on("key", onKey);
    term.on("resize", onResize);
  };

  const enqueue = (action: () => Promise<void>): void => {
    actionChain = actionChain
      .then(action)
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        state = {
          ...state,
          isBusy: false,
          statusMessage: createStatusMessage("error", message),
        };
        rerender();
      });
  };

  const onKey = (keyName: string): void => {
    if (state.isBusy) {
      return;
    }

    enqueue(async () => {
      if (state.view === "doctor") {
        if (["ESCAPE", "q", "Q", "d", "D"].includes(keyName)) {
          state = {
            ...state,
            view: "main",
            statusMessage: createStatusMessage("info", "Closed doctor report."),
          };
          rerender();
        }
        return;
      }

      const visibleRows = getVisibleRows(context, state);
      const selectedRow = getSelectedRow(visibleRows, state.selectedIndex);

      if (["ESCAPE", "q", "Q", "CTRL_C"].includes(keyName)) {
        await close();
        return;
      }

      if (["UP", "k", "K"].includes(keyName)) {
        state = moveSelection(state, visibleRows.length, -1);
        rerender();
        return;
      }

      if (["DOWN", "j", "J"].includes(keyName)) {
        state = moveSelection(state, visibleRows.length, 1);
        rerender();
        return;
      }

      if (["ENTER", "KP_ENTER", "SPACE"].includes(keyName)) {
        const toggle = canToggleServerRow(selectedRow);
        if (!toggle.allowed || !selectedRow) {
          state = {
            ...state,
            statusMessage: createStatusMessage("warning", toggle.reason ?? "That server cannot be toggled."),
          };
          rerender();
          return;
        }

        state = {
          ...state,
          isBusy: true,
          statusMessage: createStatusMessage("info", `Saving ${selectedRow.name}...`),
        };
        rerender();

        context = await deps.toggleRepoServerSelection(context, selectedRow.name, toggle.nextEnabled, options);
        doctorView = null;
        const nextRows = getVisibleRows(context, state);
        const nextIndex = Math.max(0, nextRows.findIndex((row) => row.name === selectedRow.name));
        state = syncStateWithRows(
          {
            ...state,
            isBusy: false,
            selectedIndex: nextIndex,
            statusMessage: createStatusMessage(
              "ok",
              toggle.nextEnabled ? `Enabled ${selectedRow.name} in repo scope.` : `Disabled ${selectedRow.name} from repo scope.`,
            ),
          },
          nextRows,
        );
        rerender();
        return;
      }

      if (["d", "D"].includes(keyName)) {
        state = {
          ...state,
          isBusy: true,
          statusMessage: createStatusMessage("info", "Loading doctor report..."),
        };
        rerender();

        doctorView = await deps.loadDoctorViewModel(options);
        state = {
          ...state,
          isBusy: false,
          view: "doctor",
          statusMessage: createStatusMessage("ok", "Doctor report loaded."),
        };
        rerender();
        return;
      }

      if (["e", "E"].includes(keyName)) {
        state = {
          ...state,
          isBusy: true,
          statusMessage: createStatusMessage("info", "Opening config in editor..."),
        };
        rerender();

        await suspendTerminal();
        try {
          context = await deps.editConfigAndReload(options);
          doctorView = null;
        } finally {
          resumeTerminal();
        }

        const rowsAfterReload = getVisibleRows(context, state);
        state = syncStateWithRows(
          {
            ...state,
            isBusy: false,
            statusMessage: createStatusMessage("ok", "Reloaded config after editor exit."),
          },
          rowsAfterReload,
        );
        rerender();
        return;
      }

      if (["r", "R"].includes(keyName)) {
        state = {
          ...state,
          isBusy: true,
          statusMessage: createStatusMessage("info", "Refreshing data..."),
        };
        rerender();

        context = await deps.buildTuiContext(options);
        doctorView = null;
        const rowsAfterRefresh = getVisibleRows(context, state);
        state = syncStateWithRows(
          {
            ...state,
            isBusy: false,
            statusMessage: createStatusMessage("ok", "Refreshed repo status."),
          },
          rowsAfterRefresh,
        );
        rerender();
        return;
      }

      if (keyName === "/") {
        state = {
          ...state,
          isBusy: true,
          statusMessage: createStatusMessage("info", "Enter a filter and press Enter."),
        };
        rerender();

        const nextFilter = await promptForFilter(term, state.filter);
        const updatedFilter = nextFilter ?? state.filter;
        const filteredRows = filterTuiServerRows(context.rows, updatedFilter);
        state = syncStateWithRows(
          {
            ...setFilter(state, updatedFilter, filteredRows.length),
            isBusy: false,
            statusMessage: createStatusMessage("ok", updatedFilter ? `Applied filter: ${updatedFilter}` : "Cleared filter."),
          },
          filteredRows,
        );
        rerender();
        return;
      }

      state = {
        ...state,
        statusMessage: createStatusMessage("info", "Unknown key. Use arrows, /, d, e, r, or q."),
      };
      rerender();
    });
  };

  term.fullscreen(true);
  term.grabInput({ safe: true });
  term.on("key", onKey);
  term.on("resize", onResize);
  rerender();

  await new Promise<void>((resolve) => {
    resolveClose = resolve;
  });
}

export async function runTuiCommandWithDeps(
  options?: TuiCommandOptions,
  deps: TuiCommandDeps = defaultDeps,
): Promise<void> {
  deps.assertInteractiveTerminal();
  const context = await deps.buildTuiContext(options);
  await runTuiSession(context, options, deps);
}

export async function runTuiCommand(options?: TuiCommandOptions): Promise<void> {
  await runTuiCommandWithDeps(options, defaultDeps);
}
