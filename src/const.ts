import { tmpdir } from "node:os";

export const tmpDir = tmpdir();
export const timestamp = `claude-arena-${new Date().toISOString().replace(/[:.]/g, "-").substring(0, 16)}`;
