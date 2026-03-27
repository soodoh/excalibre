import path from "node:path";
import { extractEpub } from "./epub";
import { extractPdf } from "./pdf";
import { extractCbz } from "./cbz";
import type { ExtractionResult } from "./types";

export type {
  ExtractedMetadata,
  ExtractedCover,
  ExtractionResult,
} from "./types";

const SUPPORTED_EXTENSIONS = new Set([
  "epub",
  "pdf",
  "cbz",
  "cbr",
  "cb7",
  "mobi",
  "azw",
  "azw3",
  "fb2",
  "djvu",
  "docx",
  "odt",
  "rtf",
  "txt",
  "html",
]);

export function isSupportedFormat(filePath: string): boolean {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}

export function getFileFormat(filePath: string): string {
  return path.extname(filePath).slice(1).toLowerCase();
}

function filenameTitle(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}

export async function extractMetadata(
  filePath: string,
): Promise<ExtractionResult> {
  const ext = getFileFormat(filePath);

  switch (ext) {
    case "epub":
      return extractEpub(filePath);
    case "pdf":
      return extractPdf(filePath);
    case "cbz":
    case "cbr":
    case "cb7":
      return extractCbz(filePath);
    default:
      // Unsupported formats: return minimal metadata from filename
      return {
        metadata: {
          title: filenameTitle(filePath),
          authors: ["Unknown"],
        },
      };
  }
}
