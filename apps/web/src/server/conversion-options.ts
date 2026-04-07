// Maps source format -> list of supported target formats (via pandoc)
const PANDOC_CONVERSIONS: Record<string, string[]> = {
	epub: ["mobi", "pdf", "docx", "html", "txt"],
	mobi: ["epub", "pdf", "docx", "html", "txt"],
	docx: ["epub", "pdf", "html", "txt"],
	html: ["epub", "pdf", "docx", "txt"],
	txt: ["epub", "html", "docx"],
};

// Formats that kepubify can convert from
const KEPUBIFY_SOURCE_FORMATS = new Set(["epub"]);

export function getSupportedConversions(sourceFormat: string): string[] {
	const format = sourceFormat.toLowerCase();
	const targets = new Set<string>();

	if (KEPUBIFY_SOURCE_FORMATS.has(format)) {
		targets.add("kepub");
	}

	for (const target of PANDOC_CONVERSIONS[format] ?? []) {
		targets.add(target);
	}

	return [...targets];
}
