// src/variation-parser.ts
// Parsing variation info from Claude output

import type { VariationInfo } from "./prompts";

/**
 * Default variation strategies used when parsing fails.
 */
export const DEFAULT_STRATEGIES = ["PERSONA", "EXEMPLAR", "CONSTRAINT", "SOCRATIC", "CHECKLIST"];

/**
 * Parse variation info from design phase output.
 * Looks for a JSON block in the output containing variation metadata.
 * Falls back to default strategies if parsing fails.
 *
 * @example
 * const output = `Some text... \`\`\`json
 * {"variations": [{"number": 1, "strategy": "PERSONA", "summary": "Expert role"}]}
 * \`\`\``;
 * parseVariationInfo(output, 1)
 * // [{ number: 1, strategy: "PERSONA", summary: "Expert role" }]
 */
export function parseVariationInfo(output: string, fallbackCount: number): VariationInfo[] {
	// Try to find JSON block in output
	const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/);
	if (jsonMatch?.[1]) {
		try {
			const parsed = JSON.parse(jsonMatch[1]);
			if (parsed.variations && Array.isArray(parsed.variations)) {
				return parsed.variations;
			}
		} catch {
			// Fall through to defaults
		}
	}

	// Default variation info
	return createDefaultVariations(fallbackCount);
}

/**
 * Create default variation info when parsing fails.
 */
export function createDefaultVariations(count: number): VariationInfo[] {
	return Array.from({ length: count }, (_, i) => ({
		number: i + 1,
		strategy: DEFAULT_STRATEGIES[i] || `VARIATION_${i + 1}`,
		summary: `Variation ${i + 1}`,
	}));
}

/**
 * Extract JSON from a markdown code block.
 * Returns null if no valid JSON block found.
 */
export function extractJsonFromMarkdown(text: string): unknown | null {
	const match = text.match(/```json\s*([\s\S]*?)\s*```/);
	if (!match || !match[1]) {
		return null;
	}

	try {
		return JSON.parse(match[1]);
	} catch {
		return null;
	}
}
