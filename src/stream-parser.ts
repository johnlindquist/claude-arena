// src/stream-parser.ts
// Stream parsing utilities for Claude CLI JSON output

/**
 * Event types from Claude CLI stream-json output.
 */
export interface ClaudeStreamEvent {
	type: "system" | "assistant" | "user";
	subtype?: string;
	model?: string;
	tools?: unknown[];
	message?: {
		id?: string;
		model?: string;
		content?: ContentBlock[];
		stop_reason?: string;
		usage?: {
			input_tokens?: number;
			output_tokens?: number;
			cache_read_input_tokens?: number;
		};
	};
	uuid?: string;
	toolUseResult?: {
		filePath?: string;
	};
}

export interface ContentBlock {
	type: "text" | "tool_use";
	text?: string;
	id?: string;
	name?: string;
	input?: {
		file_path?: string;
		path?: string;
		command?: string;
		// MCP wrapper tool fields (e.g., mcp__cm__call_tool)
		name?: string;
		args?: Record<string, unknown>;
	};
}

/**
 * Parse a single line of stream-json output.
 * Returns the parsed event or null if invalid.
 */
export function parseStreamLine(line: string): ClaudeStreamEvent | null {
	if (!line.trim()) return null;

	try {
		return JSON.parse(line) as ClaudeStreamEvent;
	} catch {
		return null;
	}
}

/**
 * Extract text content from an assistant message event.
 */
export function extractTextContent(event: ClaudeStreamEvent): string[] {
	if (event.type !== "assistant" || !event.message?.content) {
		return [];
	}

	return event.message.content
		.filter(
			(block): block is ContentBlock & { text: string } =>
				block.type === "text" && typeof block.text === "string",
		)
		.map((block) => block.text);
}

/**
 * Extract tool use info from an assistant message event.
 */
export function extractToolUses(event: ClaudeStreamEvent): Array<{
	id: string;
	name: string;
	filePath?: string;
}> {
	if (event.type !== "assistant" || !event.message?.content) {
		return [];
	}

	return event.message.content
		.filter(
			(block): block is ContentBlock & { id: string; name: string } =>
				block.type === "tool_use" && typeof block.id === "string",
		)
		.map((block) => ({
			id: block.id,
			name: block.name || "Tool",
			filePath: block.input?.file_path || block.input?.path,
		}));
}

/**
 * Extract usage stats from an end_turn event.
 */
export function extractUsageStats(event: ClaudeStreamEvent): {
	inputTokens: number;
	outputTokens: number;
	cachedTokens: number;
} | null {
	if (
		event.type !== "assistant" ||
		event.message?.stop_reason !== "end_turn" ||
		!event.message?.usage
	) {
		return null;
	}

	const usage = event.message.usage;
	return {
		inputTokens: usage.input_tokens || 0,
		outputTokens: usage.output_tokens || 0,
		cachedTokens: usage.cache_read_input_tokens || 0,
	};
}

/**
 * Accumulated state for stream parsing.
 */
export interface StreamParserState {
	fullContent: string;
	seenTextIds: Set<string>;
	seenToolIds: Set<string>;
	buffer: string;
}

/**
 * Create a new stream parser state.
 */
export function createStreamParserState(): StreamParserState {
	return {
		fullContent: "",
		seenTextIds: new Set(),
		seenToolIds: new Set(),
		buffer: "",
	};
}

/**
 * Process a chunk of stream data.
 * Returns complete lines and updates the buffer.
 */
export function processStreamChunk(state: StreamParserState, chunk: string): string[] {
	state.buffer += chunk;
	const lines = state.buffer.split("\n");
	state.buffer = lines.pop() || "";
	return lines;
}

/**
 * Process an event and accumulate text content.
 * Handles deduplication of text blocks using message ID.
 */
export function accumulateTextFromEvent(
	state: StreamParserState,
	event: ClaudeStreamEvent,
): string {
	if (event.type !== "assistant" || !event.message?.content) {
		return "";
	}

	let newText = "";
	const msgId = event.message.id || event.uuid || "";

	for (let i = 0; i < event.message.content.length; i++) {
		const block = event.message.content[i];
		if (!block) continue;

		if (block.type === "text" && block.text) {
			const textKey = `${msgId}-text-${i}`;
			if (!state.seenTextIds.has(textKey)) {
				state.seenTextIds.add(textKey);
				newText += block.text;
				state.fullContent += block.text;
			}
		}
	}

	return newText;
}

/**
 * Format tool use for display.
 */
export function formatToolUse(toolName: string, filePath?: string): string {
	if (filePath) {
		return `📝 ${toolName}: ${filePath}`;
	}
	return `🔧 ${toolName}`;
}

/**
 * Format usage stats for display.
 */
export function formatUsageStats(stats: {
	inputTokens: number;
	outputTokens: number;
	cachedTokens: number;
}): string {
	return `📊 Tokens: ${stats.inputTokens} in (${stats.cachedTokens} cached) → ${stats.outputTokens} out`;
}
