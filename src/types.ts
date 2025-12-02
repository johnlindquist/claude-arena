// src/types.ts

/**
 * A goal describes what behavior the markdown should produce.
 * Can be design principles, code smells to avoid, style rules, etc.
 */
export interface EvalGoal {
  name: string;
  description: string;
  criteria: string[];  // Specific things to look for
}

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
  goal: EvalGoal;             // What to evaluate against
  model: string;
  settingSource?: "user" | "project";  // For CLAUDE.md compat
  tasksPerGoal: number;
}

export interface JudgeFeedback {
  rule: string;
  strength: "too-weak" | "appropriate" | "too-strict";
  suggestion?: string;
  evidence: string;
}

export interface EvalResult {
  goalAchieved: boolean;
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
