/** Documents module — gestione documenti e allegati. */
export const DOCUMENTS_MODULE = "documents" as const;

export { DocumentsPage } from "./documents-page";
export { DocumentUploadForm } from "./components/document-upload-form";
export { DocumentsList } from "./components/documents-list";
export {
  uploadDocumentAction,
  deleteDocumentAction,
  getDocumentDownloadUrlAction,
} from "./actions/document-actions";
export {
  listDocuments,
  uploadDocument,
  deleteDocument,
  createDocumentSignedUrl,
  getDocumentsDashboardMetrics,
  type DocumentListItem,
} from "./services/documents.service";
