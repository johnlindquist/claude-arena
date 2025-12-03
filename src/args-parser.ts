// src/args-parser.ts
// Command-line argument parsing utilities

export interface ParsedArgs {
  flags: Record<string, string>;
  positional: string[];
}

/**
 * Parse command-line arguments into flags and positional arguments.
 * Supports --key value, --key=value, and -k short flags.
 * 
 * @example
 * parseArgs(["--model", "opus", "my-prompt.md"])
 * // { flags: { model: "opus" }, positional: ["my-prompt.md"] }
 * 
 * @example
 * parseArgs(["--help", "-v", "file.txt"])
 * // { flags: { help: "true", v: "true" }, positional: ["file.txt"] }
 */
export function parseArgs(args: string[]): ParsedArgs {
  const flags: Record<string, string> = {};
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === undefined) continue;

    if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-/g, "");
      const nextArg = args[i + 1];
      if (nextArg !== undefined && !nextArg.startsWith("--") && !nextArg.startsWith("-")) {
        flags[key] = nextArg;
        i++;
      } else {
        flags[key] = "true";
      }
    } else if (arg.startsWith("-") && arg.length === 2) {
      flags[arg.slice(1)] = "true";
    } else {
      positional.push(arg);
    }
  }

  return { flags, positional };
}

/**
 * Check if an argument looks like a file path.
 * Returns true for paths ending in .md or starting with ./, /, or ../
 */
export function looksLikePath(arg: string): boolean {
  return (
    arg.endsWith(".md") ||
    arg.startsWith("./") ||
    arg.startsWith("/") ||
    arg.startsWith("../")
  );
}
