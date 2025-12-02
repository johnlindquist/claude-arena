// src/types.ts

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
  claudeMdPath: string;
  settingSource: "user" | "project";
  model: string;
  tasksPerPreference: number;
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
