let runtimeStarted = false;

export async function ensureRuntimeStarted(): Promise<void> {
	if (runtimeStarted) {
		return;
	}

	runtimeStarted = true;

	const { ensureSchedulerStarted } = await import("./scheduler");
	ensureSchedulerStarted();
}
