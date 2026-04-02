import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import type { ExtractionResult } from "./types";

export async function extractPdf(filePath: string): Promise<ExtractionResult> {
	const buffer = await readFile(filePath);
	const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });

	const rawTitle = pdfDoc.getTitle();
	const rawAuthor = pdfDoc.getAuthor();
	const rawSubject = pdfDoc.getSubject();
	const rawProducer = pdfDoc.getProducer();
	const rawCreationDate = pdfDoc.getCreationDate();
	const pageCount = pdfDoc.getPageCount();

	const title = rawTitle?.trim() ?? undefined;
	const authors = rawAuthor?.trim() ? [rawAuthor.trim()] : [];

	return {
		metadata: {
			title: title ?? "Unknown",
			authors: authors.length > 0 ? authors : ["Unknown"],
			description: rawSubject?.trim() ?? undefined,
			publisher: rawProducer?.trim() ?? undefined,
			publishDate: rawCreationDate?.toISOString() ?? undefined,
			pageCount: pageCount > 0 ? pageCount : undefined,
		},
	};
}
