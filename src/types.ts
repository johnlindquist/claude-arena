// src/types.ts

/**
 * A system prompt describes what behavior the markdown should produce.
 * Can be design principles, code smells to avoid, style rules, etc.
 */
export interface SystemPromptSpec {
  name: string;
  description: string;
  criteria: string[];  // Specific things to look for
}

/**
 * Legacy type alias for backwards compatibility
 */
export type EvalGoal = SystemPromptSpec;

/**
 * Legacy type for backwards compatibility
 */
export interface CodingPreference {
  name: string;
  description: string;
  evaluationCriteria: string[];
}

export interface TestTask {
  prompt: string;
  description: string;
}

export interface TestConfig {
  markdownPath: string;       // Path to any markdown file
  systemPrompt: SystemPromptSpec;  // What to evaluate against
  model: string;
  settingSource?: "user" | "project";  // For CLAUDE.md compat
  tasksPerPrompt: number;
}

export interface JudgeFeedback {
  rule: string;
  strength: "too-weak" | "appropriate" | "too-strict";
  suggestion?: string;
  evidence: string;
}

export interface EvalResult {
  promptAdhered: boolean;
  baselineScore: number;
  configuredScore: number;
  improvement: number;
  feedback: JudgeFeedback[];
  suggestedChanges: string[];  // Markdown diffs to apply
}

export interface CIResult {
  passed: boolean;
  preferences: {
    name: string;
    baseline: number;
    configured: number;
    improvement: number;
    status: "pass" | "fail";
  }[];
  overallImprovement: number;
  summary: string;
}
