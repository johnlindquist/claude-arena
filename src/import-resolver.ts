// src/import-resolver.ts
// Resolves @filepath imports in CLAUDE.md files

import { homedir } from "node:os";
import { resolve, dirname } from "node:path";

/**
 * Resolve @filepath imports in markdown content.
 * Supports:
 * - @~/path/to/file.md (home directory)
 * - @./relative/path.md (relative to source file)
 * - @/absolute/path.md (absolute paths)
 *
 * @param content - The markdown content with @imports
 * @param sourcePath - Path of the source file (for relative imports)
 * @returns Content with all @imports inlined
 */
export async function resolveImports(
  content: string,
  sourcePath: string
): Promise<string> {
  const importRegex = /^@(~?[^\s]+\.md)$/gm;
  const matches = [...content.matchAll(importRegex)];

  if (matches.length === 0) {
    return content;
  }

  let result = content;
  const sourceDir = dirname(sourcePath);

  for (const match of matches) {
    const importPath = match[1];
    if (!importPath) continue;

    const fullMatch = match[0];
    let resolvedPath: string;

    if (importPath.startsWith("~/")) {
      // Home directory path
      resolvedPath = resolve(homedir(), importPath.slice(2));
    } else if (importPath.startsWith("/")) {
      // Absolute path
      resolvedPath = importPath;
    } else {
      // Relative path
      resolvedPath = resolve(sourceDir, importPath);
    }

    try {
      const importedFile = Bun.file(resolvedPath);
      if (await importedFile.exists()) {
        let importedContent = await importedFile.text();
        // Recursively resolve imports in the imported file
        importedContent = await resolveImports(importedContent, resolvedPath);
        result = result.replace(fullMatch, importedContent.trim());
      } else {
        // Keep the import as-is if file doesn't exist (with a warning comment)
        result = result.replace(
          fullMatch,
          `<!-- Import not found: ${importPath} -->`
        );
      }
    } catch (error) {
      result = result.replace(
        fullMatch,
        `<!-- Failed to import: ${importPath} -->`
      );
    }
  }

  return result;
}
