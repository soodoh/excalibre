import { and, asc, eq, lt } from "drizzle-orm";
import { db } from "src/db";
import { jobs } from "src/db/schema";
import { convertBook } from "src/server/converter";
import { fixEpub } from "src/server/epub-fixer";

const POLL_INTERVAL_MS = 5000; // 5 seconds when idle
const BUSY_INTERVAL_MS = 100; // 100ms when there was work

let workerStarted = false;

async function processNextJob(): Promise<boolean> {
	// Find the oldest pending job that hasn't exceeded maxAttempts
	const job = db
		.select()
		.from(jobs)
		.where(and(eq(jobs.status, "pending"), lt(jobs.attempts, jobs.maxAttempts)))
		.orderBy(asc(jobs.priority), asc(jobs.createdAt))
		.limit(1)
		.get();

	if (!job) {
		return false;
	}

	// Mark as running, increment attempts
	db.update(jobs)
		.set({
			status: "running",
			attempts: job.attempts + 1,
			startedAt: new Date(),
		})
		.where(eq(jobs.id, job.id))
		.run();

	const isFinalAttempt = job.attempts + 1 >= job.maxAttempts;

	try {
		let result: Record<string, unknown> = {};

		if (job.type === "convert") {
			const payload = job.payload as {
				bookFileId: number;
				targetFormat: string;
			};
			const newBookFile = await convertBook(
				payload.bookFileId,
				payload.targetFormat,
			);
			result = { bookFileId: newBookFile.id };
		} else if (job.type === "epub_fix") {
			const payload = job.payload as { bookFileId: number };
			const newBookFile = await fixEpub(payload.bookFileId);
			result = newBookFile ? { bookFileId: newBookFile.id } : { skipped: true };
		} else {
			throw new Error(`Unknown job type: ${String(job.type)}`);
		}

		db.update(jobs)
			.set({
				status: "completed",
				result,
				completedAt: new Date(),
			})
			.where(eq(jobs.id, job.id))
			.run();
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);

		db.update(jobs)
			.set({
				status: isFinalAttempt ? "failed" : "pending",
				error: errorMessage,
				startedAt: null,
			})
			.where(eq(jobs.id, job.id))
			.run();
	}

	return true;
}

async function runWorkerLoop(): Promise<void> {
	const hadWork = await processNextJob();
	const delay = hadWork ? BUSY_INTERVAL_MS : POLL_INTERVAL_MS;
	setTimeout(() => void runWorkerLoop(), delay);
}

export function ensureJobWorkerStarted(): void {
	if (workerStarted) {
		return;
	}
	workerStarted = true;
	void runWorkerLoop();
}
