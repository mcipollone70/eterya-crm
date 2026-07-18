export interface ManualErrorSolution {
  problem: string;
  solution: string;
}

export interface ManualSection {
  id: string;
  title: string;
  purpose: string;
  /** Se true, mostra il box "Funzione prevista in un prossimo aggiornamento." */
  comingSoon?: boolean;
  steps?: string[];
  tips?: string[];
  errors?: ManualErrorSolution[];
  /** Mostra un placeholder media nella sezione */
  showMedia?: boolean;
}

export interface ManualMeta {
  manualVersion: string;
  crmVersion: string;
  lastUpdated: string;
}

export interface ManualChecklistGroup {
  id: string;
  title: string;
  items: string[];
}

export interface ManualFaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface ManualChangelogEntry {
  version: string;
  date: string;
  title: string;
  highlights: string[];
}

export interface ManualAdminTopic {
  id: string;
  title: string;
  description: string;
  steps: string[];
  /** Se valorizzato, mostra avviso operazione tecnica */
  technicalNote: string | null;
}

export type ManualIndexKind =
  | "checklists"
  | "section"
  | "faq"
  | "changelog"
  | "admin";

export interface ManualIndexItem {
  id: string;
  title: string;
  kind: ManualIndexKind;
}

export interface ManualSearchResult {
  id: string;
  title: string;
  excerpt: string;
  kind: ManualIndexKind;
}
