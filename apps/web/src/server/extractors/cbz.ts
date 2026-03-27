import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";
import path from "node:path";
import type {
  ExtractionResult,
  ExtractedCover,
  ExtractedMetadata,
} from "./types";

type ObjRecord = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "bmp",
  "tiff",
]);

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    tiff: "image/tiff",
  };
  return map[ext.toLowerCase()] ?? "image/jpeg";
}

function getObj(value: unknown): ObjRecord {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as ObjRecord;
  }
  return {};
}

function getText(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return undefined;
}

function splitCommaList(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildPublishDate(
  year: string,
  month: string | undefined,
  day: string | undefined,
): string {
  if (month && day) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  if (month) {
    return `${year}-${String(month).padStart(2, "0")}`;
  }
  return year;
}

type ComicInfoResult = Partial<ExtractedMetadata> & { rawTitle?: string };

function parseSeriesIndex(raw: string | undefined): number | undefined {
  if (!raw) {
    return undefined;
  }
  const n = Number.parseFloat(raw);
  return Number.isNaN(n) ? undefined : n;
}

function parsePageCount(raw: string | undefined): number | undefined {
  if (!raw) {
    return undefined;
  }
  const n = Number.parseInt(raw, 10);
  return !Number.isNaN(n) && n > 0 ? n : undefined;
}

function parseComicInfo(xml: string): ComicInfoResult {
  const parsed = getObj(parser.parse(xml) as unknown);
  const info = getObj(parsed["ComicInfo"] ?? parsed["comicinfo"]);

  const rawTitle = getText(info["Title"])?.trim();
  const rawWriter = getText(info["Writer"])?.trim();
  const rawSummary = getText(info["Summary"])?.trim();
  const rawPublisher = getText(info["Publisher"])?.trim();
  const rawYear = getText(info["Year"]);
  const rawSeries = getText(info["Series"])?.trim();
  const rawGenre = getText(info["Genre"])?.trim();
  const rawLanguage = getText(info["LanguageISO"])?.trim();

  const authors = rawWriter ? splitCommaList(rawWriter) : [];
  const publishDate = rawYear
    ? buildPublishDate(rawYear, getText(info["Month"]), getText(info["Day"]))
    : undefined;

  return {
    rawTitle,
    authors,
    description: rawSummary ?? undefined,
    publisher: rawPublisher ?? undefined,
    publishDate,
    series: rawSeries ?? undefined,
    seriesIndex: parseSeriesIndex(getText(info["Number"])),
    tags: rawGenre ? splitCommaList(rawGenre) : undefined,
    language: rawLanguage ?? undefined,
    pageCount: parsePageCount(getText(info["PageCount"])),
  };
}

function extractFirstImageCover(zip: AdmZip): ExtractedCover | undefined {
  const imageEntries = zip
    .getEntries()
    .filter((e) => {
      const ext = path.extname(e.entryName).slice(1).toLowerCase();
      return IMAGE_EXTENSIONS.has(ext) && !e.isDirectory;
    })
    .toSorted((a, b) => a.entryName.localeCompare(b.entryName));

  if (imageEntries.length === 0) {
    return undefined;
  }

  const firstImage = imageEntries[0];
  const ext = path.extname(firstImage.entryName).slice(1).toLowerCase();
  return {
    data: Buffer.from(firstImage.getData()),
    mimeType: getMimeType(ext),
    extension: ext,
  };
}

export function extractCbz(filePath: string): ExtractionResult {
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries();
  const fallbackTitle = path.basename(filePath, path.extname(filePath));

  const comicInfoEntry = entries.find(
    (e) => e.entryName.toLowerCase() === "comicinfo.xml",
  );

  let title: string;
  let partialMeta: Omit<ExtractedMetadata, "title">;

  if (comicInfoEntry) {
    const xml = comicInfoEntry.getData().toString("utf8");
    const { rawTitle, ...rest } = parseComicInfo(xml);
    title = rawTitle ?? fallbackTitle;
    const authors =
      rest.authors && rest.authors.length > 0 ? rest.authors : ["Unknown"];
    partialMeta = { ...rest, authors };
  } else {
    title = fallbackTitle;
    partialMeta = { authors: ["Unknown"] };
  }

  const cover = extractFirstImageCover(zip);

  return {
    metadata: { title, ...partialMeta },
    cover,
  };
}
