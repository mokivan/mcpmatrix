import fs from "fs";
import path from "path";

type PackageMetadata = {
  version: string;
};

let cachedPackageMetadata: PackageMetadata | null = null;

function getPackageJsonPath(): string {
  return path.resolve(__dirname, "..", "..", "package.json");
}

function loadPackageMetadata(): PackageMetadata {
  if (cachedPackageMetadata) {
    return cachedPackageMetadata;
  }

  const packageJsonPath = getPackageJsonPath();
  const rawMetadata = fs.readFileSync(packageJsonPath, "utf8");
  const parsedMetadata = JSON.parse(rawMetadata) as { version?: unknown };

  if (typeof parsedMetadata.version !== "string" || parsedMetadata.version.trim() === "") {
    throw new Error(`internal: invalid package version in ${packageJsonPath}`);
  }

  cachedPackageMetadata = {
    version: parsedMetadata.version,
  };

  return cachedPackageMetadata;
}

export function getPackageVersion(): string {
  return loadPackageMetadata().version;
}
