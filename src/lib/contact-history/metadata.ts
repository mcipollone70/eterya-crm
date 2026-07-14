import type { Json } from "@/lib/supabase/types";

export interface ContactHistoryAttachmentStub {
  id?: string;
  name: string;
  url?: string | null;
  mime_type?: string | null;
}

export interface ContactHistoryMetadata {
  attachments?: ContactHistoryAttachmentStub[];
  source?: "manual" | "visit";
}

export function parseContactHistoryMetadata(metadata: Json | null | undefined): ContactHistoryMetadata {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  const record = metadata as Record<string, unknown>;
  const attachments = Array.isArray(record.attachments)
    ? record.attachments
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((item) => ({
          id: typeof item.id === "string" ? item.id : undefined,
          name: typeof item.name === "string" ? item.name : "Allegato",
          url: typeof item.url === "string" ? item.url : null,
          mime_type: typeof item.mime_type === "string" ? item.mime_type : null,
        }))
    : [];

  return {
    attachments,
    source: record.source === "visit" ? "visit" : record.source === "manual" ? "manual" : undefined,
  };
}

export function buildContactHistoryMetadata(
  input?: ContactHistoryMetadata
): ContactHistoryMetadata {
  return {
    attachments: input?.attachments ?? [],
    source: input?.source ?? "manual",
  };
}

export function countAttachmentStubs(metadata: Json | null | undefined): number {
  return parseContactHistoryMetadata(metadata).attachments?.length ?? 0;
}
