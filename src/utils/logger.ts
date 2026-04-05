function useColor(): boolean {
  return !process.env.NO_COLOR && process.stdout.isTTY === true;
}

function colorize(code: number, message: string): string {
  if (!useColor()) {
    return message;
  }

  return `\u001b[${code}m${message}\u001b[0m`;
}

export function logInfo(message: string): void {
  console.log(colorize(36, message));
}

export function logWarn(message: string): void {
  console.warn(colorize(33, `Warning: ${message}`));
}

export function logError(message: string): void {
  console.error(colorize(31, `Error: ${message}`));
}
