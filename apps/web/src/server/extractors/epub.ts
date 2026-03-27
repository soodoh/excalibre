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
  isArray: (name) =>
    ["dc:creator", "dc:subject", "item", "itemref"].includes(name),
});

function getText(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object" && value !== null && "#text" in value) {
    const text = (value as ObjRecord)["#text"];
    if (typeof text === "string") {
      return text;
    }
  }
  return undefined;
}

function getAttr(value: unknown, attr: string): string | undefined {
  if (typeof value === "object" && value !== null) {
    const v = (value as ObjRecord)[`@_${attr}`];
    if (typeof v === "string") {
      return v;
    }
  }
  return undefined;
}

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
  };
  return map[ext.toLowerCase()] ?? "image/jpeg";
}

function getExtension(filename: string): string {
  return path.extname(filename).slice(1).toLowerCase() || "jpg";
}

function toArr(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (value !== null && value !== undefined) {
    return [value];
  }
  return [];
}

function getObj(value: unknown): ObjRecord {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as ObjRecord;
  }
  return {};
}

/** Find the OPF file path from META-INF/container.xml */
function findOpfPath(zip: AdmZip): string | undefined {
  const containerEntry = zip.getEntry("META-INF/container.xml");
  if (!containerEntry) {
    return undefined;
  }

  const containerXml = containerEntry.getData().toString("utf8");
  const parsed = parser.parse(containerXml) as unknown;
  const container = getObj(parsed);
  const outerContainer = getObj(container["container"]);
  const rootfiles = getObj(outerContainer["rootfiles"]);
  const rootfile = rootfiles["rootfile"];

  if (Array.isArray(rootfile)) {
    return getAttr(rootfile[0], "full-path");
  }
  return getAttr(rootfile, "full-path");
}

/** Extract DC metadata fields from parsed OPF metadata object */
function extractDcMetadata(
  meta: ObjRecord,
): Pick<
  ExtractedMetadata,
  | "title"
  | "authors"
  | "description"
  | "language"
  | "publisher"
  | "publishDate"
  | "tags"
  | "isbn"
> {
  const title = getText(meta["dc:title"]) ?? "Unknown";

  const creatorsArr = toArr(meta["dc:creator"]);
  const rawAuthors = creatorsArr.map((c) => getText(c) ?? "").filter(Boolean);
  const authors = rawAuthors.length > 0 ? rawAuthors : ["Unknown"];

  const description = getText(meta["dc:description"]);
  const language = getText(meta["dc:language"]);
  const publisher = getText(meta["dc:publisher"]);
  const publishDate = getText(meta["dc:date"]);

  const subjectsArr = toArr(meta["dc:subject"]);
  const rawTags = subjectsArr.map((s) => getText(s) ?? "").filter(Boolean);
  const tags = rawTags.length > 0 ? rawTags : undefined;

  const isbn = extractIsbn(toArr(meta["dc:identifier"]));

  return {
    title,
    authors,
    description,
    language,
    publisher,
    publishDate,
    tags,
    isbn,
  };
}

/** Find an ISBN from an array of dc:identifier values */
function extractIsbn(identifiers: unknown[]): string | undefined {
  for (const id of identifiers) {
    const scheme = getAttr(id, "opf:scheme") ?? getAttr(id, "scheme") ?? "";
    const text = getText(id) ?? "";
    const normalized = text.replaceAll("-", "");
    if (
      scheme.toUpperCase().includes("ISBN") ||
      /^97[89]\d{10}$/.test(normalized) ||
      /^\d{10}$/.test(normalized)
    ) {
      return text;
    }
  }
  return undefined;
}

/** Extract calibre series metadata from <meta> tags */
function extractCalibremeta(
  metaArr: unknown[],
): Pick<ExtractedMetadata, "series" | "seriesIndex"> {
  let series: string | undefined;
  let seriesIndex: number | undefined;

  for (const meta of metaArr) {
    const name = getAttr(meta, "name");
    const content = getAttr(meta, "content");
    if (name === "calibre:series" && content) {
      series = content;
    }
    if (name === "calibre:series_index" && content) {
      const n = Number.parseFloat(content);
      if (!Number.isNaN(n)) {
        seriesIndex = n;
      }
    }
  }

  return { series, seriesIndex };
}

/** Find cover item ID from <meta name="cover"> tags */
function findCoverItemId(metaArr: unknown[]): string | undefined {
  for (const meta of metaArr) {
    const name = getAttr(meta, "name");
    const content = getAttr(meta, "content");
    if (name === "cover" && content) {
      return content;
    }
  }
  return undefined;
}

/** Resolve cover path from manifest items */
function resolveCoverPath(
  items: unknown[],
  opfDir: string,
  coverItemId: string | undefined,
): string | undefined {
  const joinWithDir = (href: string) =>
    opfDir && opfDir !== "." ? path.posix.join(opfDir, href) : href;

  if (coverItemId) {
    for (const item of items) {
      const id = getAttr(item, "id");
      const href = getAttr(item, "href");
      if (id === coverItemId && href) {
        return joinWithDir(href);
      }
    }
  }

  // EPUB 3: properties="cover-image"
  for (const item of items) {
    const props = getAttr(item, "properties") ?? "";
    const href = getAttr(item, "href");
    if (props.includes("cover-image") && href) {
      return joinWithDir(href);
    }
  }

  return undefined;
}

/** Search for cover by common filenames */
function findCoverByCommonName(zip: AdmZip): string | undefined {
  const commonNames = [
    "cover.jpg",
    "cover.jpeg",
    "cover.png",
    "cover.gif",
    "images/cover.jpg",
    "images/cover.jpeg",
    "images/cover.png",
    "OEBPS/cover.jpg",
    "OEBPS/images/cover.jpg",
  ];
  for (const name of commonNames) {
    if (zip.getEntry(name)) {
      return name;
    }
  }
  return undefined;
}

/** Load cover data from ZIP */
function loadCover(zip: AdmZip, coverPath: string): ExtractedCover | undefined {
  const normalizedPath = coverPath.replaceAll("\\", "/");
  const coverEntry =
    zip.getEntry(normalizedPath) ??
    zip.getEntry(decodeURIComponent(normalizedPath));
  if (!coverEntry) {
    return undefined;
  }

  const ext = getExtension(normalizedPath);
  return {
    data: Buffer.from(coverEntry.getData()),
    mimeType: getMimeType(ext),
    extension: ext,
  };
}

const UNKNOWN_RESULT: ExtractionResult = {
  metadata: { title: "Unknown", authors: ["Unknown"] },
};

export function extractEpub(filePath: string): ExtractionResult {
  const zip = new AdmZip(filePath);

  const opfPath = findOpfPath(zip);
  if (!opfPath) {
    return UNKNOWN_RESULT;
  }

  const opfEntry = zip.getEntry(opfPath);
  if (!opfEntry) {
    return UNKNOWN_RESULT;
  }

  const opfXml = opfEntry.getData().toString("utf8");
  const opf = getObj(parser.parse(opfXml) as unknown);
  const pkg = getObj(opf["package"] ?? opf["opf:package"]);
  const metadata = getObj(pkg["metadata"] ?? pkg["opf:metadata"]);
  const manifest = getObj(pkg["manifest"] ?? pkg["opf:manifest"]);
  const manifestItem = manifest["item"];
  let items: unknown[];
  if (Array.isArray(manifestItem)) {
    items = manifestItem;
  } else if (manifestItem) {
    items = [manifestItem];
  } else {
    items = [];
  }

  const dcMeta = extractDcMetadata(metadata);
  const metaArr = toArr(metadata["meta"]);
  const calMeta = extractCalibremeta(metaArr);

  const opfDir = path.dirname(opfPath);
  const coverItemId = findCoverItemId(metaArr);
  const coverPath =
    resolveCoverPath(items, opfDir, coverItemId) ?? findCoverByCommonName(zip);
  const cover = coverPath ? loadCover(zip, coverPath) : undefined;

  return {
    metadata: { ...dcMeta, ...calMeta },
    cover,
  };
}
