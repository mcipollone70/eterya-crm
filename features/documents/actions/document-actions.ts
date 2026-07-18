"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  isAllowedDocumentType,
  MAX_DOCUMENT_SIZE_BYTES,
} from "@/lib/constants/documents";
import type { AttachmentEntityType } from "@/lib/supabase/types";
import {
  createDocumentSignedUrl,
  deleteDocument,
  uploadDocument,
} from "../services/documents.service";

const NOT_CONFIGURED_MESSAGE =
  "Database non configurato. Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local e riavvia il server.";

const VALID_ENTITY_TYPES: AttachmentEntityType[] = [
  "company",
  "opportunity",
  "product",
  "contact",
  "activity",
  "visit",
  "voice_note",
];

function revalidateDocumentPaths(entityType: AttachmentEntityType, entityId: string) {
  revalidatePath("/documenti");
  if (entityType === "company") {
    revalidatePath(`/companies/${entityId}`);
  }
}

export async function uploadDocumentAction(
  formData: FormData
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  const entityType = String(formData.get("entity_type") ?? "") as AttachmentEntityType;
  const entityId = String(formData.get("entity_id") ?? "").trim();
  const file = formData.get("file");

  if (!VALID_ENTITY_TYPES.includes(entityType) || !entityId) {
    return { success: false, message: "Entità collegata non valida." };
  }

  if (!(file instanceof File) || file.size === 0) {
    return { success: false, message: "Seleziona un file da caricare." };
  }

  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return { success: false, message: "Il file supera la dimensione massima di 15 MB." };
  }

  if (!isAllowedDocumentType(file.type, file.name)) {
    return {
      success: false,
      message: "Formato non supportato. Ammessi PDF, Word, Excel e immagini.",
    };
  }

  const { error } = await uploadDocument({ entityType, entityId, file });
  if (error) {
    return { success: false, message: error };
  }

  revalidateDocumentPaths(entityType, entityId);
  return { success: true, message: "Documento caricato." };
}

export async function deleteDocumentAction(
  documentId: string,
  entityType: AttachmentEntityType,
  entityId: string
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  const { error } = await deleteDocument(documentId);
  if (error) {
    return { success: false, message: error };
  }

  revalidateDocumentPaths(entityType, entityId);
  return { success: true, message: "Documento eliminato." };
}

export async function getDocumentDownloadUrlAction(
  documentId: string
): Promise<{ url: string | null; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { url: null, error: NOT_CONFIGURED_MESSAGE };
  }

  return createDocumentSignedUrl(documentId);
}
