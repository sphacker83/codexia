import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export async function writeTextFileAtomically(filePath: string, payload: string): Promise<void> {
  const directoryPath = path.dirname(filePath);
  const tempFilePath = path.join(
    directoryPath,
    `.${path.basename(filePath)}.${process.pid}.${randomUUID().replaceAll("-", "")}.tmp`,
  );

  await fs.mkdir(directoryPath, { recursive: true });

  try {
    await fs.writeFile(tempFilePath, payload, "utf8");
    await fs.rename(tempFilePath, filePath);
  } catch (error) {
    await fs.unlink(tempFilePath).catch(() => undefined);
    throw error;
  }
}
