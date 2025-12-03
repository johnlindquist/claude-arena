// src/prompt-input.ts
// Simple interactive input utilities for CLI

import * as readline from "node:readline";

/**
 * Prompt the user for input and return their response
 */
export async function prompt(question: string): Promise<string> {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			rl.close();
			resolve(answer.trim());
		});
	});
}

/**
 * Prompt the user to select from numbered options
 * Returns the selected option index (0-based) or -1 if invalid
 */
export async function selectOption(question: string, options: string[]): Promise<number> {
	console.log(question);
	console.log("");
	options.forEach((opt, i) => {
		console.log(`  ${i + 1}. ${opt}`);
	});
	console.log("");

	const answer = await prompt("Enter selection (number): ");
	const selection = Number.parseInt(answer, 10);

	if (Number.isNaN(selection) || selection < 1 || selection > options.length) {
		return -1;
	}

	return selection - 1;
}

/**
 * Prompt for yes/no confirmation
 * Returns true for yes, false for no
 */
export async function confirm(question: string, defaultYes = true): Promise<boolean> {
	const hint = defaultYes ? "[Y/n]" : "[y/N]";
	const answer = await prompt(`${question} ${hint}: `);

	if (answer === "") {
		return defaultYes;
	}

	return answer.toLowerCase().startsWith("y");
}
