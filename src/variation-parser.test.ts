import { describe, it, expect } from "vitest";
import {
  parseVariationInfo,
  createDefaultVariations,
  extractJsonFromMarkdown,
  DEFAULT_STRATEGIES,
} from "./variation-parser";

describe("parseVariationInfo", () => {
  it("should parse valid JSON block from output", () => {
    const output = `
Some text before...

\`\`\`json
{
  "variations": [
    { "number": 1, "strategy": "PERSONA", "summary": "Expert role framing" },
    { "number": 2, "strategy": "EXEMPLAR", "summary": "Show by example" }
  ]
}
\`\`\`

Some text after...
    `;

    const result = parseVariationInfo(output, 2);

    expect(result).toEqual([
      { number: 1, strategy: "PERSONA", summary: "Expert role framing" },
      { number: 2, strategy: "EXEMPLAR", summary: "Show by example" },
    ]);
  });

  it("should return default variations when JSON parsing fails", () => {
    const output = "No JSON here, just plain text";

    const result = parseVariationInfo(output, 3);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      number: 1,
      strategy: "PERSONA",
      summary: "Variation 1",
    });
  });

  it("should return default variations when JSON is malformed", () => {
    const output = `
\`\`\`json
{ invalid json here
\`\`\`
    `;

    const result = parseVariationInfo(output, 2);

    expect(result).toHaveLength(2);
    expect(result[0].strategy).toBe("PERSONA");
    expect(result[1].strategy).toBe("EXEMPLAR");
  });

  it("should return default variations when JSON lacks variations array", () => {
    const output = `
\`\`\`json
{ "something": "else" }
\`\`\`
    `;

    const result = parseVariationInfo(output, 2);

    expect(result).toHaveLength(2);
    expect(result[0].number).toBe(1);
  });

  it("should handle more variations than default strategies", () => {
    const output = "no json";

    const result = parseVariationInfo(output, 7);

    expect(result).toHaveLength(7);
    expect(result[5].strategy).toBe("VARIATION_6");
    expect(result[6].strategy).toBe("VARIATION_7");
  });
});

describe("createDefaultVariations", () => {
  it("should create variations with default strategies", () => {
    const result = createDefaultVariations(3);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      number: 1,
      strategy: "PERSONA",
      summary: "Variation 1",
    });
    expect(result[1]).toEqual({
      number: 2,
      strategy: "EXEMPLAR",
      summary: "Variation 2",
    });
    expect(result[2]).toEqual({
      number: 3,
      strategy: "CONSTRAINT",
      summary: "Variation 3",
    });
  });

  it("should use numbered fallback for counts beyond default strategies", () => {
    const result = createDefaultVariations(6);

    expect(result[4].strategy).toBe("CHECKLIST");
    expect(result[5].strategy).toBe("VARIATION_6");
  });

  it("should handle zero count", () => {
    const result = createDefaultVariations(0);
    expect(result).toEqual([]);
  });
});

describe("extractJsonFromMarkdown", () => {
  it("should extract and parse valid JSON from markdown code block", () => {
    const text = `
Some text
\`\`\`json
{"key": "value", "num": 42}
\`\`\`
More text
    `;

    const result = extractJsonFromMarkdown(text);

    expect(result).toEqual({ key: "value", num: 42 });
  });

  it("should return null for text without JSON block", () => {
    const text = "Just regular text without any code blocks";

    expect(extractJsonFromMarkdown(text)).toBeNull();
  });

  it("should return null for invalid JSON in code block", () => {
    const text = `
\`\`\`json
not valid json {{{
\`\`\`
    `;

    expect(extractJsonFromMarkdown(text)).toBeNull();
  });

  it("should handle JSON arrays", () => {
    const text = `
\`\`\`json
[1, 2, 3]
\`\`\`
    `;

    expect(extractJsonFromMarkdown(text)).toEqual([1, 2, 3]);
  });

  it("should handle multiline JSON", () => {
    const text = `
\`\`\`json
{
  "nested": {
    "array": [1, 2, 3],
    "string": "hello"
  }
}
\`\`\`
    `;

    const result = extractJsonFromMarkdown(text);

    expect(result).toEqual({
      nested: {
        array: [1, 2, 3],
        string: "hello",
      },
    });
  });
});

describe("DEFAULT_STRATEGIES", () => {
  it("should contain the expected strategies", () => {
    expect(DEFAULT_STRATEGIES).toEqual([
      "PERSONA",
      "EXEMPLAR",
      "CONSTRAINT",
      "SOCRATIC",
      "CHECKLIST",
    ]);
  });
});
