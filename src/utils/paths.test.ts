import { describe, expect, it } from "vitest";
import { normalizeRepoPath } from "./paths";

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
});
