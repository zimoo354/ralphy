import { NextResponse } from "next/server";
import { stopRun } from "@/lib/process-runner";
import {
	readRuns,
	writeRuns,
	readRunLog,
	readRunArgs,
	readRunTasks,
	deleteRunDir,
} from "@/lib/storage";

export async function POST(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const stopped = stopRun(id);
	if (!stopped) {
		return NextResponse.json(
			{ error: "Run not found or not running" },
			{ status: 400 },
		);
	}
	return NextResponse.json({ ok: true });
}

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const runs = readRuns();
	const run = runs.find((r) => r.id === id);
	if (!run) {
		return NextResponse.json({ error: "Run not found" }, { status: 404 });
	}
	const log = readRunLog(id);
	const args = readRunArgs(id);
	const tasks = readRunTasks(id);
	return NextResponse.json({
		...run,
		log: log || undefined,
		args: args ?? undefined,
		tasks: tasks || undefined,
	});
}

export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const runs = readRuns();
	const idx = runs.findIndex((r) => r.id === id);
	if (idx === -1) {
		return NextResponse.json({ error: "Run not found" }, { status: 404 });
	}
	runs.splice(idx, 1);
	writeRuns(runs);
	deleteRunDir(id);
	return NextResponse.json({ ok: true });
}
