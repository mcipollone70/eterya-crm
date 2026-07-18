import type { AttachmentEntityType } from "@/lib/supabase/types";

export const DOCUMENTS_BUCKET = "documents";

export const DOCUMENT_ENTITY_TYPES = [
  "company",
  "opportunity",
  "product",
] as const satisfies readonly AttachmentEntityType[];

export const DOCUMENT_ENTITY_LABELS: Record<string, string> = {
  company: "Azienda",
  opportunity: "Opportunità",
  product: "Prodotto",
  contact: "Contatto",
  activity: "Attività",
  visit: "Visita",
  voice_note: "Nota vocale",
};

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const ALLOWED_DOCUMENT_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
];

export const MAX_DOCUMENT_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

export function isAllowedDocumentType(mimeType: string, fileName: string): boolean {
  if ((ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return true;
  }
  const lower = fileName.toLowerCase();
  return ALLOWED_DOCUMENT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

const ENTITY_TYPE_SET = new Set<string>([
  "company",
  "contact",
  "activity",
  "visit",
  "voice_note",
  "opportunity",
  "product",
]);

export function isAttachmentEntityType(value: string | undefined): value is AttachmentEntityType {
  return value != null && ENTITY_TYPE_SET.has(value);
}

export function formatFileSize(bytes: number | null): string {
  if (bytes == null) {
    return "—";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDocumentMimeLabel(mimeType: string | null): string {
  if (!mimeType) {
    return "File";
  }
  if (mimeType.startsWith("image/")) {
    return "Immagine";
  }
  if (mimeType.includes("pdf")) {
    return "PDF";
  }
  if (mimeType.includes("sheet") || mimeType.includes("excel")) {
    return "Excel";
  }
  if (mimeType.includes("word") || mimeType.includes("document")) {
    return "Word";
  }
  return mimeType;
}
