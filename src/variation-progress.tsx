/**
 * Ink-based progress display for parallel variation execution.
 * Shows real-time status updates for each variation as they run.
 */

import { Box, Text, render, useApp } from "ink";
import React, { useState, useEffect, useCallback } from "react";
import type { VariationInfo, VariationResult } from "./prompts";

export type TaskStatus = "pending" | "running" | "done" | "error";

export interface TaskState {
	id: number;
	label: string;
	status: TaskStatus;
	detail?: string;
	exitCode?: number;
}

// Status indicator component
function StatusIcon({ status }: { status: TaskStatus }) {
	switch (status) {
		case "pending":
			return <Text color="gray">◌</Text>;
		case "running":
			return <Text color="cyan">●</Text>;
		case "done":
			return <Text color="green">✓</Text>;
		case "error":
			return <Text color="red">✗</Text>;
	}
}

// Single task row
function TaskRow({ task }: { task: TaskState }) {
	return (
		<Box>
			<Box width={3}>
				<StatusIcon status={task.status} />
			</Box>
			<Box width={4}>
				<Text dimColor>[{task.id}]</Text>
			</Box>
			<Box width={14}>
				<Text bold={task.status === "running"}>{task.label}</Text>
			</Box>
			<Box>
				<Text dimColor>
					{task.status === "done" || task.status === "error"
						? `exit ${task.exitCode}`
						: task.detail || ""}
				</Text>
			</Box>
		</Box>
	);
}

interface ProgressProps {
	initialTasks: TaskState[];
	runVariations: (
		updateTask: (id: number, updates: Partial<TaskState>) => void,
	) => Promise<VariationResult[]>;
	onComplete: (results: VariationResult[]) => void;
}

function VariationProgress({ initialTasks, runVariations, onComplete }: ProgressProps) {
	const { exit } = useApp();
	const [tasks, setTasks] = useState<TaskState[]>(initialTasks);
	const [elapsed, setElapsed] = useState(0);
	const [completed, setCompleted] = useState(false);

	// Update a specific task - stable reference for callbacks
	const updateTask = useCallback((id: number, updates: Partial<TaskState>) => {
		setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
	}, []);

	// Start all variations
	useEffect(() => {
		let mounted = true;

		const run = async () => {
			const results = await runVariations(updateTask);
			if (mounted) {
				setCompleted(true);
				// Small delay to show final state before exit
				setTimeout(() => {
					onComplete(results);
					exit();
				}, 300);
			}
		};

		run();

		return () => {
			mounted = false;
		};
	}, [runVariations, updateTask, onComplete, exit]);

	// Elapsed timer
	useEffect(() => {
		const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
		return () => clearInterval(interval);
	}, []);

	const doneCount = tasks.filter((t) => t.status === "done").length;
	const errorCount = tasks.filter((t) => t.status === "error").length;
	const runningCount = tasks.filter((t) => t.status === "running").length;

	return (
		<Box flexDirection="column">
			<Box marginBottom={1}>
				<Text>
					<Text color="yellow" bold>
						{" ⏳ Running variations... "}
					</Text>
					<Text dimColor>({elapsed}s elapsed)</Text>
				</Text>
			</Box>

			{tasks.map((task) => (
				<TaskRow key={task.id} task={task} />
			))}

			<Box marginTop={1}>
				<Text dimColor>
					{runningCount > 0 || !completed
						? `Running: ${runningCount} | Done: ${doneCount} | Failed: ${errorCount}`
						: `Complete: ${doneCount} succeeded, ${errorCount} failed`}
				</Text>
			</Box>
		</Box>
	);
}

/**
 * Run variations with an Ink-based progress display.
 * Mounts Ink, runs all variations in parallel with live updates, then unmounts.
 *
 * @param variationInfo - Array of variation metadata (number, strategy)
 * @param executor - Function that runs a single variation, receives onStatus callback
 * @returns Promise resolving to array of VariationResult
 */
export async function runVariationsWithProgress(
	variationInfo: VariationInfo[],
	executor: (
		variation: VariationInfo,
		onStatus: (status: string) => void,
	) => Promise<VariationResult>,
): Promise<VariationResult[]> {
	const initialTasks: TaskState[] = variationInfo.map((v) => ({
		id: v.number,
		label: v.strategy,
		status: "pending" as TaskStatus,
	}));

	return new Promise((resolve) => {
		const runVariations = async (
			updateTask: (id: number, updates: Partial<TaskState>) => void,
		): Promise<VariationResult[]> => {
			// Start all variations in parallel
			const promises = variationInfo.map(async (variation) => {
				const id = variation.number;

				// Mark as running
				updateTask(id, { status: "running", detail: "starting..." });

				try {
					// Execute with status callback
					const result = await executor(variation, (status) => {
						updateTask(id, { detail: status });
					});

					// Mark complete
					updateTask(id, {
						status: result.exitCode === 0 ? "done" : "error",
						exitCode: result.exitCode,
					});

					return result;
				} catch (error) {
					// Handle unexpected errors
					updateTask(id, { status: "error", exitCode: 1 });
					return {
						variationNumber: id,
						output: `ERROR: ${error}`,
						exitCode: 1,
					};
				}
			});

			return Promise.all(promises);
		};

		render(
			<VariationProgress
				initialTasks={initialTasks}
				runVariations={runVariations}
				onComplete={resolve}
			/>,
		);
	});
}
