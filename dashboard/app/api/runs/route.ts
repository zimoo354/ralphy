import { NextResponse } from "next/server";
import { readRuns } from "@/lib/storage";

export async function GET() {
	const runs = readRuns();
	return NextResponse.json(runs);
}
