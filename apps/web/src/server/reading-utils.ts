export function normalizeReadingProgress(progress: number): number {
	if (progress < 0) {
		return 0;
	}

	if (progress > 1) {
		return 1;
	}

	return progress;
}
