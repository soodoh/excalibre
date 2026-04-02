import { db } from "src/db";
import { libraries } from "src/db/schema";
import { ensureJobWorkerStarted } from "src/server/job-worker";
import { scanLibrary } from "src/server/scanner";

const SCHEDULER_INTERVAL_MS = 60_000; // 60 seconds

let schedulerStarted = false;

async function checkAndRunDueScans(): Promise<void> {
	const allLibraries = await db.select().from(libraries);

	for (const library of allLibraries) {
		const intervalMs = library.scanInterval * 60 * 1000;
		const now = Date.now();
		const lastScanned = library.lastScannedAt
			? library.lastScannedAt.getTime()
			: 0;
		const isDue = now - lastScanned >= intervalMs;

		if (isDue) {
			try {
				await scanLibrary(library.id);
			} catch {
				// Scan failure is non-fatal; library will be retried on next interval
			}
		}
	}
}

export function ensureSchedulerStarted(): void {
	if (schedulerStarted) {
		return;
	}
	schedulerStarted = true;

	ensureJobWorkerStarted();

	setInterval(() => {
		void checkAndRunDueScans();
	}, SCHEDULER_INTERVAL_MS);
}
