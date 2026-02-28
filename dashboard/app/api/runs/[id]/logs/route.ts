import { NextResponse } from "next/server";
import { readRuns, readRunLog } from "@/lib/storage";

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
	return new NextResponse(log, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
		},
	});
}
