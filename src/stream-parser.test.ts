import { describe, expect, it } from "vitest";
import {
	type ClaudeStreamEvent,
	accumulateTextFromEvent,
	createStreamParserState,
	extractTextContent,
	extractToolUses,
	extractUsageStats,
	formatToolUse,
	formatUsageStats,
	parseStreamLine,
	processStreamChunk,
} from "./stream-parser";

describe("parseStreamLine", () => {
	it("should parse valid JSON line", () => {
		const line = '{"type":"assistant","message":{"content":[]}}';
		const result = parseStreamLine(line);

		expect(result).toEqual({
			type: "assistant",
			message: { content: [] },
		});
	});

	it("should return null for empty line", () => {
		expect(parseStreamLine("")).toBeNull();
		expect(parseStreamLine("   ")).toBeNull();
	});

	it("should return null for invalid JSON", () => {
		expect(parseStreamLine("not json")).toBeNull();
		expect(parseStreamLine("{invalid}")).toBeNull();
	});
});

describe("extractTextContent", () => {
	it("should extract text from assistant message", () => {
		const event: ClaudeStreamEvent = {
			type: "assistant",
			message: {
				content: [
					{ type: "text", text: "Hello " },
					{ type: "text", text: "World" },
				],
			},
		};

		expect(extractTextContent(event)).toEqual(["Hello ", "World"]);
	});

	it("should return empty array for non-assistant events", () => {
		const event: ClaudeStreamEvent = {
			type: "system",
			message: { content: [{ type: "text", text: "ignored" }] },
		};

		expect(extractTextContent(event)).toEqual([]);
	});

	it("should filter out non-text blocks", () => {
		const event: ClaudeStreamEvent = {
			type: "assistant",
			message: {
				content: [
					{ type: "text", text: "keep" },
					{ type: "tool_use", id: "123", name: "Write" },
					{ type: "text", text: "also keep" },
				],
			},
		};

		expect(extractTextContent(event)).toEqual(["keep", "also keep"]);
	});

	it("should return empty array when no content", () => {
		const event: ClaudeStreamEvent = {
			type: "assistant",
			message: {},
		};

		expect(extractTextContent(event)).toEqual([]);
	});
});

describe("extractToolUses", () => {
	it("should extract tool use info from assistant message", () => {
		const event: ClaudeStreamEvent = {
			type: "assistant",
			message: {
				content: [
					{
						type: "tool_use",
						id: "tool-1",
						name: "Write",
						input: { file_path: "/src/index.ts" },
					},
					{
						type: "tool_use",
						id: "tool-2",
						name: "Read",
						input: { path: "/package.json" },
					},
				],
			},
		};

		const result = extractToolUses(event);

		expect(result).toEqual([
			{ id: "tool-1", name: "Write", filePath: "/src/index.ts" },
			{ id: "tool-2", name: "Read", filePath: "/package.json" },
		]);
	});

	it("should return empty array for non-assistant events", () => {
		const event: ClaudeStreamEvent = {
			type: "user",
			message: {
				content: [{ type: "tool_use", id: "123", name: "Test" }],
			},
		};

		expect(extractToolUses(event)).toEqual([]);
	});

	it("should handle tool use without file path", () => {
		const event: ClaudeStreamEvent = {
			type: "assistant",
			message: {
				content: [{ type: "tool_use", id: "tool-1", name: "Shell", input: {} }],
			},
		};

		const result = extractToolUses(event);

		expect(result).toEqual([{ id: "tool-1", name: "Shell", filePath: undefined }]);
	});
});

describe("extractUsageStats", () => {
	it("should extract usage stats from end_turn event", () => {
		const event: ClaudeStreamEvent = {
			type: "assistant",
			message: {
				stop_reason: "end_turn",
				usage: {
					input_tokens: 1000,
					output_tokens: 500,
					cache_read_input_tokens: 200,
				},
			},
		};

		const result = extractUsageStats(event);

		expect(result).toEqual({
			inputTokens: 1000,
			outputTokens: 500,
			cachedTokens: 200,
		});
	});

	it("should return null for non-end_turn events", () => {
		const event: ClaudeStreamEvent = {
			type: "assistant",
			message: {
				usage: { input_tokens: 100, output_tokens: 50 },
			},
		};

		expect(extractUsageStats(event)).toBeNull();
	});

	it("should handle missing usage fields", () => {
		const event: ClaudeStreamEvent = {
			type: "assistant",
			message: {
				stop_reason: "end_turn",
				usage: {},
			},
		};

		const result = extractUsageStats(event);

		expect(result).toEqual({
			inputTokens: 0,
			outputTokens: 0,
			cachedTokens: 0,
		});
	});

	it("should return null for non-assistant events", () => {
		const event: ClaudeStreamEvent = {
			type: "system",
			message: {
				stop_reason: "end_turn",
				usage: { input_tokens: 100 },
			},
		};

		expect(extractUsageStats(event)).toBeNull();
	});
});

describe("createStreamParserState", () => {
	it("should create empty state", () => {
		const state = createStreamParserState();

		expect(state.fullContent).toBe("");
		expect(state.buffer).toBe("");
		expect(state.seenTextIds.size).toBe(0);
		expect(state.seenToolIds.size).toBe(0);
	});
});

describe("processStreamChunk", () => {
	it("should split complete lines and buffer incomplete", () => {
		const state = createStreamParserState();

		const lines = processStreamChunk(state, "line1\nline2\npartial");

		expect(lines).toEqual(["line1", "line2"]);
		expect(state.buffer).toBe("partial");
	});

	it("should accumulate buffer across chunks", () => {
		const state = createStreamParserState();

		processStreamChunk(state, "start");
		const lines = processStreamChunk(state, "end\ncomplete\n");

		expect(lines).toEqual(["startend", "complete"]);
		expect(state.buffer).toBe("");
	});

	it("should handle chunk with only newline", () => {
		const state = createStreamParserState();
		state.buffer = "buffered";

		const lines = processStreamChunk(state, "\n");

		expect(lines).toEqual(["buffered"]);
		expect(state.buffer).toBe("");
	});
});

describe("accumulateTextFromEvent", () => {
	it("should accumulate text and track seen IDs", () => {
		const state = createStreamParserState();
		const event: ClaudeStreamEvent = {
			type: "assistant",
			message: {
				id: "msg-1",
				content: [
					{ type: "text", text: "Hello " },
					{ type: "text", text: "World" },
				],
			},
		};

		const result = accumulateTextFromEvent(state, event);

		expect(result).toBe("Hello World");
		expect(state.fullContent).toBe("Hello World");
		expect(state.seenTextIds.has("msg-1-text-0")).toBe(true);
		expect(state.seenTextIds.has("msg-1-text-1")).toBe(true);
	});

	it("should deduplicate repeated events", () => {
		const state = createStreamParserState();
		const event: ClaudeStreamEvent = {
			type: "assistant",
			message: {
				id: "msg-1",
				content: [{ type: "text", text: "Hello" }],
			},
		};

		accumulateTextFromEvent(state, event);
		const secondResult = accumulateTextFromEvent(state, event);

		expect(secondResult).toBe("");
		expect(state.fullContent).toBe("Hello");
	});

	it("should use uuid when id is missing", () => {
		const state = createStreamParserState();
		const event: ClaudeStreamEvent = {
			type: "assistant",
			uuid: "uuid-123",
			message: {
				content: [{ type: "text", text: "Test" }],
			},
		};

		accumulateTextFromEvent(state, event);

		expect(state.seenTextIds.has("uuid-123-text-0")).toBe(true);
	});

	it("should return empty string for non-assistant events", () => {
		const state = createStreamParserState();
		const event: ClaudeStreamEvent = {
			type: "user",
			message: { content: [{ type: "text", text: "ignored" }] },
		};

		const result = accumulateTextFromEvent(state, event);

		expect(result).toBe("");
		expect(state.fullContent).toBe("");
	});
});

describe("formatToolUse", () => {
	it("should format tool with file path", () => {
		expect(formatToolUse("Write", "/src/index.ts")).toBe("📝 Write: /src/index.ts");
	});

	it("should format tool without file path", () => {
		expect(formatToolUse("Shell")).toBe("🔧 Shell");
		expect(formatToolUse("Shell", undefined)).toBe("🔧 Shell");
	});
});

describe("formatUsageStats", () => {
	it("should format usage stats with all values", () => {
		const result = formatUsageStats({
			inputTokens: 1000,
			outputTokens: 500,
			cachedTokens: 200,
		});

		expect(result).toBe("📊 Tokens: 1000 in (200 cached) → 500 out");
	});

	it("should format usage stats with zeros", () => {
		const result = formatUsageStats({
			inputTokens: 0,
			outputTokens: 0,
			cachedTokens: 0,
		});

		expect(result).toBe("📊 Tokens: 0 in (0 cached) → 0 out");
	});
});
