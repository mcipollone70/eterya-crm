import Link from "next/link";
import { FileSpreadsheet, FileText, ImageIcon, Paperclip } from "lucide-react";
import {
  DOCUMENT_ENTITY_LABELS,
  formatDocumentMimeLabel,
  formatFileSize,
} from "@/lib/constants/documents";
import type { DocumentListItem } from "../services/documents.service";
import { DocumentRowActions } from "./document-row-actions";

interface DocumentsListProps {
  items: DocumentListItem[];
  showEntity?: boolean;
}

function documentIcon(mimeType: string | null) {
  if (!mimeType) {
    return Paperclip;
  }
  if (mimeType.startsWith("image/")) {
    return ImageIcon;
  }
  if (mimeType.includes("sheet") || mimeType.includes("excel")) {
    return FileSpreadsheet;
  }
  return FileText;
}

export function DocumentsList({ items, showEntity = true }: DocumentsListProps) {
  return (
    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
      {items.map((item) => {
        const Icon = documentIcon(item.mime_type);
        return (
          <li key={item.id} className="flex items-center gap-3 px-4 py-3 text-sm">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-900">{item.file_name}</p>
              <p className="text-xs text-slate-500">
                {formatDocumentMimeLabel(item.mime_type)} · {formatFileSize(item.file_size)} ·{" "}
                {new Date(item.created_at).toLocaleDateString("it-IT")}
                {item.uploaded_by_name ? ` · ${item.uploaded_by_name}` : ""}
              </p>
              {showEntity && item.entity_type === "company" && item.entity_name ? (
                <Link
                  href={`/companies/${item.entity_id}`}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  {DOCUMENT_ENTITY_LABELS[item.entity_type]}: {item.entity_name}
                </Link>
              ) : showEntity ? (
                <span className="text-xs text-slate-400">
                  {DOCUMENT_ENTITY_LABELS[item.entity_type] ?? item.entity_type}
                </span>
              ) : null}
            </div>
            <DocumentRowActions
              documentId={item.id}
              entityType={item.entity_type}
              entityId={item.entity_id}
              fileName={item.file_name}
            />
          </li>
        );
      })}
    </ul>
  );
}
