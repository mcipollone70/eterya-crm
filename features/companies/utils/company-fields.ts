import type { FormSection, SelectOption } from "@/lib/forms";
import type { CompanyStatus } from "@/lib/supabase/types";

/** Etichette stato azienda — sorgente unica riusata da lista, dettaglio e form. */
export const COMPANY_STATUS_LABELS: Record<CompanyStatus, string> = {
  active: "Attiva",
  inactive: "Inattiva",
  prospect: "Prospect",
  lead: "Lead",
  archived: "Archiviata",
};

export const COMPANY_STATUS_OPTIONS: SelectOption[] = (
  Object.keys(COMPANY_STATUS_LABELS) as CompanyStatus[]
).map((value) => ({ value, label: COMPANY_STATUS_LABELS[value] }));

/**
 * Definizione dei campi del form azienda (creazione + modifica).
 * Alimenta sia il rendering che il mapping FormData → riga `companies`,
 * così i nomi combaciano sempre con le colonne del DB.
 */
export const COMPANY_FORM_SECTIONS: FormSection[] = [
  {
    title: "Anagrafica",
    fields: [
      { name: "name", label: "Ragione sociale", required: true, colSpan: 2 },
      { name: "legal_name", label: "Denominazione legale" },
      { name: "status", label: "Stato", type: "select", required: true, options: COMPANY_STATUS_OPTIONS },
      { name: "vat_number", label: "Partita IVA" },
      { name: "tax_code", label: "Codice fiscale" },
      { name: "category", label: "Categoria" },
      { name: "sector", label: "Settore" },
    ],
  },
  {
    title: "Indirizzo",
    fields: [
      { name: "address", label: "Indirizzo", colSpan: 2 },
      { name: "postal_code", label: "CAP" },
      { name: "city", label: "Comune" },
      { name: "province", label: "Provincia" },
      { name: "region", label: "Regione" },
      { name: "country", label: "Nazione", placeholder: "IT" },
    ],
  },
  {
    title: "Contatti azienda",
    fields: [
      { name: "phone", label: "Telefono", type: "tel" },
      { name: "mobile", label: "Cellulare", type: "tel" },
      { name: "email", label: "Email", type: "email" },
      { name: "pec", label: "PEC", type: "email" },
      { name: "website", label: "Sito web", type: "url", colSpan: 2 },
    ],
  },
  {
    title: "Referente principale",
    fields: [
      { name: "contact_name", label: "Nome referente" },
      { name: "contact_role", label: "Ruolo referente" },
      { name: "contact_phone", label: "Telefono referente", type: "tel" },
      { name: "contact_email", label: "Email referente", type: "email" },
    ],
  },
  {
    title: "Note",
    fields: [
      { name: "notes", label: "Note", type: "textarea", colSpan: 2 },
      { name: "internal_notes", label: "Note interne", type: "textarea", colSpan: 2 },
    ],
  },
];
