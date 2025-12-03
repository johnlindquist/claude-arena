// src/import-resolver.ts
// Resolves @filepath imports in CLAUDE.md files

import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

/**
 * File reader interface for dependency injection (enables testing)
 */
export interface FileReader {
	exists(path: string): Promise<boolean>;
	read(path: string): Promise<string>;
}

/**
 * Default file reader using Bun
 */
export const defaultFileReader: FileReader = {
	exists: async (path: string) => {
		const file = Bun.file(path);
		return file.exists();
	},
	read: async (path: string) => {
		const file = Bun.file(path);
		return file.text();
	},
};

/**
 * Resolve an import path to an absolute path
 */
export function resolveImportPath(importPath: string, sourceDir: string): string {
	if (importPath.startsWith("~/")) {
		// Home directory path
		return resolve(homedir(), importPath.slice(2));
	}
	if (importPath.startsWith("/")) {
		// Absolute path
		return importPath;
	}
	// Relative path
	return resolve(sourceDir, importPath);
}

/**
 * Resolve @filepath imports in markdown content.
 * Supports:
 * - @~/path/to/file.md (home directory)
 * - @./relative/path.md (relative to source file)
 * - @/absolute/path.md (absolute paths)
 *
 * @param content - The markdown content with @imports
 * @param sourcePath - Path of the source file (for relative imports)
 * @param fileReader - Optional file reader for testing
 * @returns Content with all @imports inlined
 */
export async function resolveImports(
	content: string,
	sourcePath: string,
	fileReader: FileReader = defaultFileReader,
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
		const resolvedPath = resolveImportPath(importPath, sourceDir);

		try {
			if (await fileReader.exists(resolvedPath)) {
				let importedContent = await fileReader.read(resolvedPath);
				// Recursively resolve imports in the imported file
				importedContent = await resolveImports(importedContent, resolvedPath, fileReader);
				result = result.replace(fullMatch, importedContent.trim());
			} else {
				// Keep the import as-is if file doesn't exist (with a warning comment)
				result = result.replace(fullMatch, `<!-- Import not found: ${importPath} -->`);
			}
		} catch (error) {
			result = result.replace(fullMatch, `<!-- Failed to import: ${importPath} -->`);
		}
	}

	return result;
}
