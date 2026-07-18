import { Paperclip } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { DocumentUploadForm } from "@/features/documents/components/document-upload-form";
import { DocumentsList } from "@/features/documents/components/documents-list";
import { listDocuments } from "@/features/documents/services/documents.service";

interface CompanyDetailDocumentsTabProps {
  companyId: string;
}

export async function CompanyDetailDocumentsTab({ companyId }: CompanyDetailDocumentsTabProps) {
  const { data: documents, error } = await listDocuments({
    entityType: "company",
    entityId: companyId,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Documenti e allegati</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-2">
        <p className="text-sm text-slate-600">
          Carica e gestisci PDF, Word, Excel e immagini collegati a questa azienda.
        </p>

        <DocumentUploadForm entityType="company" entityId={companyId} />

        {error && <p className="text-sm text-rose-700">{error}</p>}

        {documents.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
            <Paperclip className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-700">Nessun documento caricato</p>
            <p className="mt-1 text-xs text-slate-500">
              Usa il pulsante Carica per aggiungere il primo documento a questa azienda.
            </p>
          </div>
        ) : (
          <DocumentsList items={documents} showEntity={false} />
        )}
      </CardContent>
    </Card>
  );
}
