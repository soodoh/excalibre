import path from "node:path";

const ABSOLUTE_SCAN_PATH_PATTERN = /^(?:[a-zA-Z]:[\\/]|[\\/]{2}|[\\/])/;

function normalizeLibraryScanPath(scanPath: string): string {
	if (ABSOLUTE_SCAN_PATH_PATTERN.test(scanPath)) {
		throw new Error("Absolute scan paths are not allowed");
	}

	const normalizedSegments: string[] = [];
	for (const segment of scanPath.split(/[\\/]+/)) {
		if (segment.length === 0 || segment === ".") {
			continue;
		}

		if (segment === "..") {
			if (normalizedSegments.length === 0) {
				throw new Error("Scan path cannot escape the data directory");
			}
			normalizedSegments.pop();
			continue;
		}

		normalizedSegments.push(segment);
	}

	return normalizedSegments.join(path.sep);
}

export function isValidLibraryScanPath(scanPath: string): boolean {
	try {
		normalizeLibraryScanPath(scanPath);
		return true;
	} catch {
		return false;
	}
}

export function resolveLibraryScanPath(
	dataDir: string,
	scanPath: string,
): string {
	return path.join(dataDir, normalizeLibraryScanPath(scanPath));
}
