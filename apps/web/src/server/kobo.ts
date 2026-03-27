import { db } from "src/db";
import { koboTokens } from "src/db/schema";
import { eq } from "drizzle-orm";
import type { books, bookFiles, authors, readingProgress } from "src/db/schema";

// ── Types ────────────────────────────────────────────────────────────────────

type Book = typeof books.$inferSelect;
type BookFile = typeof bookFiles.$inferSelect;
type Author = typeof authors.$inferSelect;
type ReadingProgressRecord = typeof readingProgress.$inferSelect;

type SyncState = {
  booksLastModified: string;
  readingStateLastModified: string;
};

type DownloadUrl = {
  Format: string;
  Size: number;
  Url: string;
  Platform: string;
};

type BookMetadata = {
  Title: string;
  Contributors?: { Author?: string };
  Description?: string;
  Language: string;
  CoverImageId: string;
  DownloadUrls: DownloadUrl[];
  EntitlementId: string;
  RevisionId: string;
  PublicationDate?: string;
  Publisher?: string;
};

type ReadingState = {
  EntitlementId: string;
  Created: string;
  LastModified: string;
  PriorityTimestamp: string;
  StatusInfo: {
    LastModified: string;
    Status: string;
    TimestampId: string;
  };
  CurrentBookmark: {
    LastModified: string;
    ProgressPercent: number;
    ContentSourceProgressPercent: number;
  };
};

type NewEntitlement = {
  NewEntitlement: {
    BookEntitlement: {
      Accessibility: string;
      ActivePeriod: { From: string };
      Created: string;
      CrossRevisionId: string;
      Id: string;
      IsRemovable: boolean;
      IsVisible: boolean;
      RevisionId: string;
      BookMetadata: BookMetadata;
    };
    BookMetadata: BookMetadata;
    ReadingState: ReadingState | null;
  };
};

// ── Authentication ────────────────────────────────────────────────────────────

export async function authenticateKobo(
  token: string,
): Promise<{ userId: string } | null> {
  const record = await db.query.koboTokens.findFirst({
    where: eq(koboTokens.token, token),
    columns: { userId: true },
  });

  if (!record) {
    return null;
  }
  return { userId: record.userId };
}

// ── Sync Token ────────────────────────────────────────────────────────────────

const DEFAULT_SYNC_STATE: SyncState = {
  booksLastModified: new Date(0).toISOString(),
  readingStateLastModified: new Date(0).toISOString(),
};

export function buildSyncToken(state: SyncState): string {
  return Buffer.from(JSON.stringify(state)).toString("base64");
}

export function parseSyncToken(token: string | null | undefined): SyncState {
  if (!token) {
    return DEFAULT_SYNC_STATE;
  }
  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as Partial<SyncState>;
    if (
      typeof parsed.booksLastModified === "string" &&
      typeof parsed.readingStateLastModified === "string"
    ) {
      return {
        booksLastModified: parsed.booksLastModified,
        readingStateLastModified: parsed.readingStateLastModified,
      };
    }
    return DEFAULT_SYNC_STATE;
  } catch {
    return DEFAULT_SYNC_STATE;
  }
}

// ── Metadata Builders ─────────────────────────────────────────────────────────

/** Converts a numeric book ID to a deterministic UUID v5-like string. */
function bookIdToUuid(bookId: number): string {
  // Use a simple deterministic format that looks like a UUID
  const hex = bookId.toString(16).padStart(8, "0");
  return `${hex}-0000-4000-8000-000000000000`;
}

export function buildBookMetadata(
  book: Book,
  files: BookFile[],
  bookAuthors: Author[],
  baseUrl: string,
  token: string,
): BookMetadata {
  const entitlementId = bookIdToUuid(book.id);

  // Prefer EPUB, then kepub, then first file
  const preferredFile =
    files.find((f) => f.format.toLowerCase() === "epub") ??
    files.find((f) => f.format.toLowerCase() === "kepub") ??
    files[0];

  const downloadUrls: DownloadUrl[] = preferredFile
    ? [
        {
          Format: "EPUB",
          Size: preferredFile.fileSize ?? 0,
          Url: `${baseUrl}/api/kobo/${token}/v1/library/${String(book.id)}/download`,
          Platform: "Generic",
        },
      ]
    : [];

  const authorNames = bookAuthors
    .filter((a) => a.name)
    .map((a) => a.name)
    .join(", ");

  return {
    Title: book.title,
    ...(authorNames ? { Contributors: { Author: authorNames } } : {}),
    ...(book.description ? { Description: book.description } : {}),
    Language: book.language ?? "en",
    CoverImageId: String(book.id),
    DownloadUrls: downloadUrls,
    EntitlementId: entitlementId,
    RevisionId: entitlementId,
    ...(book.publishDate ? { PublicationDate: book.publishDate } : {}),
    ...(book.publisher ? { Publisher: book.publisher } : {}),
  };
}

export function buildReadingState(
  progress: ReadingProgressRecord | null | undefined,
  bookId: number,
): ReadingState {
  const entitlementId = bookIdToUuid(bookId);
  const now = new Date().toISOString();
  const lastModified = progress?.updatedAt?.toISOString() ?? now;

  let status = "ReadyToRead";
  if (progress?.isFinished) {
    status = "Finished";
  } else if (progress && progress.progress > 0) {
    status = "Reading";
  }

  const progressPercent = Math.round((progress?.progress ?? 0) * 100);

  return {
    EntitlementId: entitlementId,
    Created: lastModified,
    LastModified: lastModified,
    PriorityTimestamp: lastModified,
    StatusInfo: {
      LastModified: lastModified,
      Status: status,
      TimestampId: lastModified,
    },
    CurrentBookmark: {
      LastModified: lastModified,
      ProgressPercent: progressPercent,
      ContentSourceProgressPercent: progressPercent,
    },
  };
}

export function buildNewEntitlement(
  book: Book,
  files: BookFile[],
  bookAuthors: Author[],
  progress: ReadingProgressRecord | null | undefined,
  baseUrl: string,
  token: string,
): NewEntitlement {
  const metadata = buildBookMetadata(book, files, bookAuthors, baseUrl, token);
  const readingState = buildReadingState(progress, book.id);
  const now = new Date().toISOString();
  const entitlementId = bookIdToUuid(book.id);

  return {
    NewEntitlement: {
      BookEntitlement: {
        Accessibility: "Full",
        ActivePeriod: { From: now },
        Created: book.createdAt.toISOString(),
        CrossRevisionId: entitlementId,
        Id: entitlementId,
        IsRemovable: true,
        IsVisible: true,
        RevisionId: entitlementId,
        BookMetadata: metadata,
      },
      BookMetadata: metadata,
      ReadingState: readingState,
    },
  };
}
