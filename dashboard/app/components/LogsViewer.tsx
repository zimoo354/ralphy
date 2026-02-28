"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface LogsViewerProps {
	content: string;
	className?: string;
}

export function LogsViewer({ content, className = "" }: LogsViewerProps) {
	const preRef = useRef<HTMLPreElement>(null);
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		const el = preRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [content]);

	const handleCopy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(content || "");
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			// ignore
		}
	}, [content]);

	const isEmpty = content.trim() === "";

	return (
		<div className={`flex flex-1 min-h-0 flex-col ${className}`}>
			<div className="flex shrink-0 items-center justify-end gap-2 border-b border-zinc-200 py-1.5 pr-2 dark:border-zinc-800">
				<button
					type="button"
					onClick={handleCopy}
					disabled={isEmpty}
					className="rounded px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
				>
					{copied ? "Copied" : "Copy"}
				</button>
			</div>
			<pre
				ref={preRef}
				className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words rounded-b bg-zinc-100 p-3 font-mono text-sm leading-relaxed text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
			>
				{isEmpty ? "(no output yet)" : content}
			</pre>
		</div>
	);
}
