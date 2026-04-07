import path from "node:path";

export function isValidLibraryScanPath(scanPath: string): boolean {
	if (path.isAbsolute(scanPath)) {
		return false;
	}

	const normalized = path.normalize(scanPath);
	return normalized !== ".." && !normalized.startsWith(`..${path.sep}`);
}

export function resolveLibraryScanPath(
	dataDir: string,
	scanPath: string,
): string {
	if (path.isAbsolute(scanPath)) {
		throw new Error("Absolute scan paths are not allowed");
	}

	const normalized = path.normalize(scanPath);
	if (normalized === ".." || normalized.startsWith(`..${path.sep}`)) {
		throw new Error("Scan path cannot escape the data directory");
	}

	return path.join(dataDir, normalized);
}
