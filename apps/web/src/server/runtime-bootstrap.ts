let runtimeStartPromise: Promise<void> | null = null;

export function ensureRuntimeStarted(): Promise<void> {
	if (runtimeStartPromise) {
		return runtimeStartPromise;
	}

	runtimeStartPromise = import("./scheduler")
		.then(({ ensureSchedulerStarted }) => {
			ensureSchedulerStarted();
		})
		.catch((error: unknown) => {
			runtimeStartPromise = null;
			throw error;
		});

	return runtimeStartPromise;
}
