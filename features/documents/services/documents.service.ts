import "server-only";

import { getCurrentUser } from "@/features/auth/session";
import { DOCUMENTS_BUCKET } from "@/lib/constants/documents";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import type { AttachmentEntityType } from "@/lib/supabase/types";

export interface DocumentListItem {
  id: string;
  entity_type: AttachmentEntityType;
  entity_id: string;
  entity_name: string | null;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  created_at: string;
}

export interface DocumentFilters {
  entityType?: AttachmentEntityType;
  entityId?: string;
  query?: string;
}

type AttachmentRow = {
  id: string;
  entity_type: AttachmentEntityType;
  entity_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
  users: { full_name: string | null } | { full_name: string | null }[] | null;
};

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

const DOCUMENT_SELECT =
  "id,entity_type,entity_id,file_name,storage_path,mime_type,file_size,uploaded_by,created_at,users:uploaded_by(full_name)";

async function resolveCompanyNames(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) {
    return map;
  }

  const supabase = await createServerClient();
  const { data } = await supabase.from("companies").select("id,name").in("id", unique);
  for (const row of data ?? []) {
    map.set(row.id, row.name);
  }
  return map;
}

export async function listDocuments(
  filters?: DocumentFilters,
  limit = 200
): Promise<{ data: DocumentListItem[]; count: number; error: string | null }> {
  const supabase = await createServerClient();

  let query = supabase
    .from("attachments")
    .select(DOCUMENT_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters?.entityType) {
    query = query.eq("entity_type", filters.entityType);
  }
  if (filters?.entityId) {
    query = query.eq("entity_id", filters.entityId);
  }
  if (filters?.query) {
    query = query.ilike("file_name", `%${filters.query}%`);
  }

  const { data, count, error } = await query;

  if (error) {
    if (/attachments|relation .* does not exist/i.test(error.message)) {
      return { data: [], count: 0, error: null };
    }
    return { data: [], count: 0, error: describeDbError(error) };
  }

  const rows = (data ?? []) as unknown as AttachmentRow[];
  const companyIds = rows
    .filter((row) => row.entity_type === "company")
    .map((row) => row.entity_id);
  const companyNames = await resolveCompanyNames(companyIds);

  const items: DocumentListItem[] = rows.map((row) => {
    const uploader = relationOne(row.users);
    return {
      id: row.id,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      entity_name: row.entity_type === "company" ? companyNames.get(row.entity_id) ?? null : null,
      file_name: row.file_name,
      storage_path: row.storage_path,
      mime_type: row.mime_type,
      file_size: row.file_size,
      uploaded_by: row.uploaded_by,
      uploaded_by_name: uploader?.full_name ?? null,
      created_at: row.created_at,
    };
  });

  return { data: items, count: count ?? items.length, error: null };
}

export async function getDocumentById(id: string): Promise<DocumentListItem | null> {
  const { data } = await listDocuments(undefined, 1000);
  return data.find((item) => item.id === id) ?? null;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

export async function uploadDocument(input: {
  entityType: AttachmentEntityType;
  entityId: string;
  file: File;
}): Promise<{ documentId: string | null; error: string | null }> {
  const user = await getCurrentUser();
  const userId = user?.id ?? null;

  const supabase = await createServerClient();
  const safeName = sanitizeFileName(input.file.name);
  const storagePath = `${input.entityType}/${input.entityId}/${Date.now()}-${safeName}`;

  const arrayBuffer = await input.file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: input.file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    if (/bucket|not found|does not exist/i.test(uploadError.message)) {
      return {
        documentId: null,
        error:
          "Bucket Storage non configurato. Esegui la migrazione 20260715_documents_storage.sql su Supabase.",
      };
    }
    return { documentId: null, error: uploadError.message };
  }

  const { data, error } = await supabase
    .from("attachments")
    .insert({
      entity_type: input.entityType,
      entity_id: input.entityId,
      file_name: input.file.name,
      storage_path: storagePath,
      mime_type: input.file.type || null,
      file_size: input.file.size,
      uploaded_by: userId,
    })
    .select("id")
    .single();

  if (error) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
    return { documentId: null, error: describeDbError(error) };
  }

  return { documentId: data.id, error: null };
}

export async function createDocumentSignedUrl(
  documentId: string
): Promise<{ url: string | null; error: string | null }> {
  const supabase = await createServerClient();
  const { data: attachment, error: fetchError } = await supabase
    .from("attachments")
    .select("storage_path")
    .eq("id", documentId)
    .maybeSingle();

  if (fetchError || !attachment) {
    return { url: null, error: "Documento non trovato." };
  }

  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(attachment.storage_path, 60);

  if (error || !data) {
    return { url: null, error: error?.message ?? "Impossibile generare il link di download." };
  }

  return { url: data.signedUrl, error: null };
}

export async function deleteDocument(
  documentId: string
): Promise<{ error: string | null }> {
  const supabase = await createServerClient();
  const { data: attachment } = await supabase
    .from("attachments")
    .select("storage_path")
    .eq("id", documentId)
    .maybeSingle();

  if (attachment?.storage_path) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([attachment.storage_path]);
  }

  const { error } = await supabase.from("attachments").delete().eq("id", documentId);
  return { error: describeDbError(error) };
}

export async function getDocumentsDashboardMetrics(): Promise<{
  data: { total: number };
  error: string | null;
}> {
  const supabase = await createServerClient();
  const { count, error } = await supabase
    .from("attachments")
    .select("id", { count: "exact", head: true });

  if (error) {
    return { data: { total: 0 }, error: describeDbError(error) };
  }

  return { data: { total: count ?? 0 }, error: null };
}
