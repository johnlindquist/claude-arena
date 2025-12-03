import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type FileReader, resolveImportPath, resolveImports } from "./import-resolver";

/**
 * Create a mock file reader from a map of path -> content
 */
function createMockFileReader(files: Record<string, string>): FileReader {
	return {
		exists: async (path: string) => path in files,
		read: async (path: string) => {
			const content = files[path];
			if (content === undefined) throw new Error(`File not found: ${path}`);
			return content;
		},
	};
}

describe("resolveImportPath", () => {
	it("should resolve home directory paths", () => {
		const result = resolveImportPath("~/.claude/test.md", "/some/dir");
		expect(result).toBe(join(homedir(), ".claude", "test.md"));
	});

	it("should resolve absolute paths unchanged", () => {
		const result = resolveImportPath("/etc/config.md", "/some/dir");
		expect(result).toBe("/etc/config.md");
	});

	it("should resolve relative paths from source directory", () => {
		const result = resolveImportPath("./local.md", "/project/.claude");
		expect(result).toBe("/project/.claude/local.md");
	});

	it("should resolve parent directory paths", () => {
		const result = resolveImportPath("../shared.md", "/project/.claude");
		expect(result).toBe("/project/shared.md");
	});
});

describe("resolveImports", () => {
	describe("no imports", () => {
		it("should return content unchanged when no imports present", async () => {
			const content = "# My CLAUDE.md\n\nSome instructions here.";
			const reader = createMockFileReader({});
			const result = await resolveImports(content, "/some/path/CLAUDE.md", reader);
			expect(result).toBe(content);
		});

		it("should return empty string unchanged", async () => {
			const reader = createMockFileReader({});
			const result = await resolveImports("", "/some/path/CLAUDE.md", reader);
			expect(result).toBe("");
		});

		it("should not treat inline @ mentions as imports", async () => {
			const content = "Contact me at @username or email@example.com";
			const reader = createMockFileReader({});
			const result = await resolveImports(content, "/some/path/CLAUDE.md", reader);
			expect(result).toBe(content);
		});

		it("should not treat @ in middle of line as import", async () => {
			const content = "Some text @~/file.md more text";
			const reader = createMockFileReader({});
			const result = await resolveImports(content, "/some/path/CLAUDE.md", reader);
			expect(result).toBe(content);
		});
	});

	describe("home directory imports (~)", () => {
		it("should resolve @~/ imports from home directory", async () => {
			const homeDir = homedir();
			const reader = createMockFileReader({
				[join(homeDir, ".claude", "preferences.md")]: "# Preferences\n- Prefer TypeScript",
			});

			const content = "# CLAUDE.md\n\n@~/.claude/preferences.md\n\nMore content";
			const result = await resolveImports(content, "/some/path/CLAUDE.md", reader);

			expect(result).toBe("# CLAUDE.md\n\n# Preferences\n- Prefer TypeScript\n\nMore content");
		});

		it("should resolve multiple home directory imports", async () => {
			const homeDir = homedir();
			const reader = createMockFileReader({
				[join(homeDir, ".claude", "facts.md")]: "Fact 1",
				[join(homeDir, ".claude", "prefs.md")]: "Pref 1",
			});

			const content = "@~/.claude/facts.md\n\n@~/.claude/prefs.md";
			const result = await resolveImports(content, "/some/path/CLAUDE.md", reader);

			expect(result).toBe("Fact 1\n\nPref 1");
		});
	});

	describe("relative imports (./)", () => {
		it("should resolve relative imports from source directory", async () => {
			const reader = createMockFileReader({
				"/project/.claude/local.md": "Local config",
			});

			const content = "@./local.md";
			const result = await resolveImports(content, "/project/.claude/CLAUDE.md", reader);

			expect(result).toBe("Local config");
		});

		it("should resolve parent directory imports (../)", async () => {
			const reader = createMockFileReader({
				"/project/shared.md": "Parent content",
			});

			const content = "@../shared.md";
			const result = await resolveImports(content, "/project/.claude/CLAUDE.md", reader);

			expect(result).toBe("Parent content");
		});
	});

	describe("absolute imports (/)", () => {
		it("should resolve absolute path imports", async () => {
			const reader = createMockFileReader({
				"/etc/claude/global.md": "Absolute content",
			});

			const content = "@/etc/claude/global.md";
			const result = await resolveImports(content, "/some/path/CLAUDE.md", reader);

			expect(result).toBe("Absolute content");
		});
	});

	describe("recursive imports", () => {
		it("should recursively resolve nested imports", async () => {
			const homeDir = homedir();
			const reader = createMockFileReader({
				[join(homeDir, ".claude", "deep.md")]: "Deep content",
				[join(homeDir, ".claude", "middle.md")]: "Middle:\n@~/.claude/deep.md",
			});

			const content = "Top:\n@~/.claude/middle.md";
			const result = await resolveImports(content, "/some/path/CLAUDE.md", reader);

			expect(result).toBe("Top:\nMiddle:\nDeep content");
		});

		it("should handle multiple levels of nesting", async () => {
			const homeDir = homedir();
			const reader = createMockFileReader({
				[join(homeDir, ".claude", "level3.md")]: "L3",
				[join(homeDir, ".claude", "level2.md")]: "L2\n@~/.claude/level3.md",
				[join(homeDir, ".claude", "level1.md")]: "L1\n@~/.claude/level2.md",
			});

			const content = "L0\n@~/.claude/level1.md";
			const result = await resolveImports(content, "/some/path/CLAUDE.md", reader);

			expect(result).toBe("L0\nL1\nL2\nL3");
		});
	});

	describe("missing files", () => {
		it("should replace missing import with HTML comment", async () => {
			const reader = createMockFileReader({});
			const content = "@~/.claude/nonexistent.md";
			const result = await resolveImports(content, "/some/path/CLAUDE.md", reader);

			expect(result).toBe("<!-- Import not found: ~/.claude/nonexistent.md -->");
		});

		it("should continue processing after missing import", async () => {
			const homeDir = homedir();
			const reader = createMockFileReader({
				[join(homeDir, ".claude", "exists.md")]: "I exist",
			});

			const content = "@~/.claude/missing.md\n\n@~/.claude/exists.md";
			const result = await resolveImports(content, "/some/path/CLAUDE.md", reader);

			expect(result).toBe("<!-- Import not found: ~/.claude/missing.md -->\n\nI exist");
		});
	});

	describe("whitespace handling", () => {
		it("should trim imported content", async () => {
			const homeDir = homedir();
			const reader = createMockFileReader({
				[join(homeDir, ".claude", "padded.md")]: "  Content with padding  \n\n",
			});

			const content = "@~/.claude/padded.md";
			const result = await resolveImports(content, "/some/path/CLAUDE.md", reader);

			expect(result).toBe("Content with padding");
		});

		it("should preserve surrounding content structure", async () => {
			const homeDir = homedir();
			const reader = createMockFileReader({
				[join(homeDir, ".claude", "insert.md")]: "Inserted",
			});

			const content = "Before\n\n@~/.claude/insert.md\n\nAfter";
			const result = await resolveImports(content, "/some/path/CLAUDE.md", reader);

			expect(result).toBe("Before\n\nInserted\n\nAfter");
		});
	});

	describe("real-world CLAUDE.md pattern", () => {
		it("should handle typical CLAUDE.md with multiple imports", async () => {
			const homeDir = homedir();
			const reader = createMockFileReader({
				[join(homeDir, ".claude", "facts.md")]: "# Facts\n- Year is 2025",
				[join(homeDir, ".claude", "preferences.md")]:
					"# Preferences\n- Use TypeScript\n- No Python",
				[join(homeDir, ".claude", "git-preferences.md")]: "# Git\n- Use conventional commits",
			});

			const content = `# Claude Code Instructions

## Imported Preferences
@~/.claude/facts.md
@~/.claude/preferences.md
@~/.claude/git-preferences.md

## Custom Rules
- Always test first`;

			const result = await resolveImports(content, join(homeDir, ".claude", "CLAUDE.md"), reader);

			expect(result).toContain("# Claude Code Instructions");
			expect(result).toContain("# Facts");
			expect(result).toContain("Year is 2025");
			expect(result).toContain("# Preferences");
			expect(result).toContain("Use TypeScript");
			expect(result).toContain("# Git");
			expect(result).toContain("conventional commits");
			expect(result).toContain("## Custom Rules");
			expect(result).toContain("Always test first");
			// Should NOT contain the import syntax anymore
			expect(result).not.toContain("@~/.claude/");
		});
	});

	describe("edge cases", () => {
		it("should only match .md files", async () => {
			const reader = createMockFileReader({});
			// The regex only matches .md files
			const content = "@~/.claude/script.js\n@~/.claude/config.json";
			const result = await resolveImports(content, "/some/path/CLAUDE.md", reader);

			// Non-.md imports should remain unchanged
			expect(result).toBe("@~/.claude/script.js\n@~/.claude/config.json");
		});

		it("should handle import at start of file", async () => {
			const homeDir = homedir();
			const reader = createMockFileReader({
				[join(homeDir, ".claude", "first.md")]: "First line content",
			});

			const content = "@~/.claude/first.md\nRest of file";
			const result = await resolveImports(content, "/some/path/CLAUDE.md", reader);

			expect(result).toBe("First line content\nRest of file");
		});

		it("should handle import at end of file", async () => {
			const homeDir = homedir();
			const reader = createMockFileReader({
				[join(homeDir, ".claude", "last.md")]: "Last line content",
			});

			const content = "Start of file\n@~/.claude/last.md";
			const result = await resolveImports(content, "/some/path/CLAUDE.md", reader);

			expect(result).toBe("Start of file\nLast line content");
		});

		it("should handle file read errors gracefully", async () => {
			const homeDir = homedir();
			const reader: FileReader = {
				exists: async () => true,
				read: async () => {
					throw new Error("Permission denied");
				},
			};

			const content = "@~/.claude/broken.md";
			const result = await resolveImports(content, "/some/path/CLAUDE.md", reader);

			expect(result).toBe("<!-- Failed to import: ~/.claude/broken.md -->");
		});
	});
});
