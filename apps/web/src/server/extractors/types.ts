export type ExtractedMetadata = {
	title: string;
	authors: string[];
	description?: string;
	language?: string;
	publisher?: string;
	publishDate?: string;
	isbn?: string;
	series?: string;
	seriesIndex?: number;
	tags?: string[];
	pageCount?: number;
};

export type ExtractedCover = {
	data: Buffer;
	mimeType: string;
	extension: string;
};

export type ExtractionResult = {
	metadata: ExtractedMetadata;
	cover?: ExtractedCover;
};
