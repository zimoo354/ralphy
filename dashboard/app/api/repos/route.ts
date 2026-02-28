import { resolve } from "node:path";
import { NextResponse } from "next/server";
import {
	readRepos,
	validateRepoPath,
	writeRepos,
	type RepoRecord,
} from "@/lib/storage";

export async function GET() {
	const repos = readRepos();
	return NextResponse.json(repos);
}

export async function POST(request: Request) {
	let body: { path?: string };
	try {
		body = await request.json();
	} catch {
		return NextResponse.json(
			{ error: "Invalid JSON body" },
			{ status: 400 },
		);
	}

	const pathInput = body.path;
	if (typeof pathInput !== "string") {
		return NextResponse.json(
			{ error: "path (string) is required" },
			{ status: 400 },
		);
	}

	const validated = validateRepoPath(pathInput);
	if (!validated.ok) {
		return NextResponse.json({ error: validated.error }, { status: 400 });
	}

	const repos = readRepos();
	const existing = repos.find(
		(r) => r.path === validated.path || resolvePathsEqual(r.path, validated.path),
	);
	if (existing) {
		return NextResponse.json(existing, { status: 200 });
	}

	const record: RepoRecord = {
		path: validated.path,
		addedAt: new Date().toISOString(),
	};
	repos.push(record);
	writeRepos(repos);
	return NextResponse.json(record, { status: 201 });
}

function resolvePathsEqual(a: string, b: string): boolean {
	return resolve(a) === resolve(b);
}
