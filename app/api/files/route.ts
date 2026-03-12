import { promises as fs } from "node:fs";
import path from "node:path";

import {
  getAgentProtectedPaths,
  getAgentWorkspaceRoot,
  isAgentProtectedPath,
} from "@/src/core/workspace/policy";

export const runtime = "nodejs";

const MAX_QUERY_LENGTH = 120;
const MAX_RESULTS = 24;
const FILE_SCAN_CACHE_TTL_MS = 60_000;
const MAX_SCAN_DEPTH = 8;

const EXCLUDED_DIRS = new Set([
  ".git",
  ".next",
  ".turbo",
  ".vscode",
  "node_modules",
  ".idea",
  "dist",
  "build",
  "coverage",
  "data",
  ".output",
]);

interface CachedFileIndex {
  at: number;
  root: string;
  protectedPathsKey: string;
  files: string[];
}

let cachedFileIndex: CachedFileIndex | null = null;

function isIgnoredDirectory(dirName: string, relativePath: string): boolean {
  if (relativePath === ".") {
    return false;
  }
  if (EXCLUDED_DIRS.has(dirName)) {
    return true;
  }
  return dirName.startsWith(".");
}

function normalizeRelativePath(filePath: string): string {
  return filePath.replaceAll(path.sep, "/");
}

async function walkProjectFiles(
  projectRoot: string,
  currentDir: string,
  depth: number,
): Promise<string[]> {
  if (depth > MAX_SCAN_DEPTH) {
    return [];
  }

  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  const found: string[] = [];

  for (const entry of entries) {
    const childPath = path.join(currentDir, entry.name);
    const relativePath = path.relative(projectRoot, childPath);
    const normalizedRelativePath = normalizeRelativePath(relativePath);

    if (isAgentProtectedPath(childPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      if (isIgnoredDirectory(entry.name, normalizedRelativePath)) {
        continue;
      }
      const nested = await walkProjectFiles(projectRoot, childPath, depth + 1);
      found.push(...nested);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (normalizedRelativePath.includes("..")) {
      continue;
    }
    found.push(normalizedRelativePath);
  }

  return found;
}

async function getProjectFiles(): Promise<string[]> {
  const projectRoot = getAgentWorkspaceRoot();
  const protectedPathsKey = getAgentProtectedPaths().join("\n");
  if (
    cachedFileIndex &&
    cachedFileIndex.root === projectRoot &&
    cachedFileIndex.protectedPathsKey === protectedPathsKey &&
    Date.now() - cachedFileIndex.at < FILE_SCAN_CACHE_TTL_MS
  ) {
    return cachedFileIndex.files;
  }

  const files = await walkProjectFiles(projectRoot, projectRoot, 0);
  const sortedFiles = files.sort((a, b) => a.localeCompare(b, "ko"));
  cachedFileIndex = {
    at: Date.now(),
    root: projectRoot,
    protectedPathsKey,
    files: sortedFiles,
  };
  return sortedFiles;
}

function scoreFileMatch(filePath: string, query: string): number | null {
  const normalizedFile = filePath.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  const index = normalizedFile.indexOf(normalizedQuery);
  if (index < 0) {
    return null;
  }

  const basename = path.basename(normalizedFile);
  if (basename === normalizedQuery) {
    return 0;
  }
  if (basename.startsWith(normalizedQuery)) {
    return 1;
  }
  if (normalizedFile.startsWith(normalizedQuery)) {
    return 2;
  }
  return 3;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") ?? "").trim();
    const limit = Number.parseInt(searchParams.get("limit") ?? String(MAX_RESULTS), 10);
    const maxLimit = Number.isNaN(limit) ? MAX_RESULTS : Math.max(1, Math.min(limit, 64));

    if (query.length > MAX_QUERY_LENGTH) {
      return Response.json(
        { error: `검색어는 최대 ${MAX_QUERY_LENGTH}자까지 입력 가능합니다.` },
        { status: 400 },
      );
    }

    const projectFiles = await getProjectFiles();
    if (!query) {
      return Response.json({ files: projectFiles.slice(0, maxLimit) }, { status: 200 });
    }

    const scored = projectFiles
      .map((filePath) => {
        const score = scoreFileMatch(filePath, query);
        return score === null ? null : { filePath, score };
      })
      .filter((candidate): candidate is { filePath: string; score: number } => candidate !== null)
      .sort((left, right) => {
        if (left.score !== right.score) {
          return left.score - right.score;
        }
        return left.filePath.localeCompare(right.filePath, "ko");
      });

    const files = scored.slice(0, maxLimit).map((item) => item.filePath);
    return Response.json({ files }, { status: 200 });
  } catch (error) {
    console.error("Failed to search files:", error);
    return Response.json({ error: "파일 목록 조회에 실패했습니다." }, { status: 500 });
  }
}
