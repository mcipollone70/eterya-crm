import { Suspense } from "react";
import { FolderOpen } from "lucide-react";
import { EmptyState, PageHeader, PageLoadingSkeleton } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isAttachmentEntityType } from "@/lib/constants/documents";
import { DocumentsFiltersBar } from "./components/documents-filters-bar";
import { DocumentsList } from "./components/documents-list";
import { listDocuments } from "./services/documents.service";

interface DocumentsPageProps {
  type?: string;
  q?: string;
}

export async function DocumentsPage({ type, q }: DocumentsPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Gestione Documenti" subtitle="Archivio documenti e allegati." />
        <EmptyState
          icon={FolderOpen}
          title="Database non configurato"
          message="Configura Supabase in .env.local per gestire i documenti."
        />
      </div>
    );
  }

  const { data: documents, count, error } = await listDocuments({
    entityType: isAttachmentEntityType(type) ? type : undefined,
    query: q?.trim() || undefined,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestione Documenti"
        subtitle={`${count.toLocaleString("it-IT")} documenti archiviati`}
      />

      <Suspense fallback={<PageLoadingSkeleton rows={1} />}>
        <DocumentsFiltersBar />
      </Suspense>

      {error ? (
        <EmptyState icon={FolderOpen} title="Impossibile caricare i documenti" message={error} />
      ) : documents.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Nessun documento"
          message="Carica documenti dalla scheda azienda (tab Documenti) oppure reimposta i filtri attivi."
        />
      ) : (
        <DocumentsList items={documents} />
      )}
    </div>
  );
}
