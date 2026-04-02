import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { getPackageVersion } from "./package-metadata";

describe("package metadata", () => {
  it("returns the version from package.json", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "..", "..", "package.json"), "utf8"),
    ) as { version: string };

    expect(getPackageVersion()).toBe(packageJson.version);
  });
});
