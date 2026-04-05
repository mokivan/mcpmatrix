import fs from "fs";

const UTF8_BOM = "\uFEFF";

export function stripUtf8Bom(content: string): string {
  return content.startsWith(UTF8_BOM) ? content.slice(1) : content;
}

export async function readTextFile(filePath: string): Promise<string> {
  const rawContent = await fs.promises.readFile(filePath, "utf8");
  return stripUtf8Bom(rawContent);
}
