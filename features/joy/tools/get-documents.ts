import "server-only";

import { listDocuments } from "@/features/documents/services/documents.service";
import { DOCUMENT_ENTITY_LABELS, formatDocumentMimeLabel } from "@/lib/constants/documents";
import { emptyToolResult, successToolResult, type JoyToolResult } from "./types";

export interface JoyDocumentsSnapshot {
  total: number;
  recentDocuments: Array<{
    id: string;
    fileName: string;
    kind: string;
    entityLabel: string;
    entityName: string | null;
    createdAt: string;
  }>;
}

export async function getDocuments(): Promise<JoyToolResult<JoyDocumentsSnapshot | null>> {
  try {
    const { data, count, error } = await listDocuments(undefined, 50);

    if (error) {
      return emptyToolResult(null, error);
    }

    return successToolResult({
      total: count,
      recentDocuments: (data ?? []).slice(0, 8).map((item) => ({
        id: item.id,
        fileName: item.file_name,
        kind: formatDocumentMimeLabel(item.mime_type),
        entityLabel: DOCUMENT_ENTITY_LABELS[item.entity_type] ?? item.entity_type,
        entityName: item.entity_name,
        createdAt: item.created_at,
      })),
    });
  } catch (error) {
    return emptyToolResult(
      null,
      error instanceof Error ? error.message : "Impossibile caricare i documenti."
    );
  }
}
