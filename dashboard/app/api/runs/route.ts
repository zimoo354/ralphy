import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { buildCommand, type NewTaskFormState } from "@/lib/command-preview";
import { startRun } from "@/lib/process-runner";
import {
	readRuns,
	writeRuns,
	writeRunArgs,
	writeRunTasks,
	validateRepoPath,
	getRunTasksPath,
} from "@/lib/storage";

export async function GET() {
	const runs = readRuns();
	return NextResponse.json(runs);
}

export async function POST(request: Request) {
	let body: NewTaskFormState;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	const validated = validateRepoPath(body.repoPath);
	if (!validated.ok) {
		return NextResponse.json({ error: validated.error }, { status: 400 });
	}

	const runId = randomUUID();
	const cmd = buildCommand(
		{ ...body, repoPath: validated.path },
		{ runTasksPath: getRunTasksPath(runId) },
	);
	if (cmd.prdFile) {
		writeRunTasks(runId, cmd.prdFile.content);
	}

	const run = {
		id: runId,
		repoPath: validated.path,
		status: "queued" as const,
		createdAt: new Date().toISOString(),
	};
	const runs = readRuns();
	runs.push(run);
	writeRuns(runs);
	writeRunArgs(runId, {
		cwd: cmd.cwd,
		argv: cmd.argv,
		engine: body.engine,
		runTests: body.runTests,
		runLint: body.runLint,
		fast: body.fast,
		parallel: body.parallel,
		maxParallel: body.maxParallel,
		sandbox: body.sandbox,
		createPr: body.createPr,
	});

	try {
		startRun(runId, { cwd: cmd.cwd, argv: cmd.argv });
	} catch (err) {
		return NextResponse.json(
			{ error: err instanceof Error ? err.message : "Failed to start run" },
			{ status: 500 },
		);
	}

	return NextResponse.json(run);
}
