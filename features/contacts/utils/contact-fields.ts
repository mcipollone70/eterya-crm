import type { FieldConfig, FormSection, SelectOption } from "@/lib/forms";

export const CONTACT_PRIMARY_OPTIONS: SelectOption[] = [
  { value: "false", label: "No" },
  { value: "true", label: "Sì" },
];

/** Campi del form contatto; l'azienda usa ricerca server-side dinamica. */
export function buildContactSections(): FormSection[] {
  return [
    {
      title: "Referente",
      fields: [
        {
          name: "company_id",
          label: "Azienda",
          type: "company_select",
          required: true,
          colSpan: 2,
        },
        { name: "full_name", label: "Nome completo", required: true, colSpan: 2 },
        { name: "role", label: "Ruolo" },
        {
          name: "is_primary",
          label: "Referente principale",
          type: "select",
          required: true,
          options: CONTACT_PRIMARY_OPTIONS,
        },
        { name: "email", label: "Email", type: "email" },
        { name: "phone", label: "Telefono", type: "tel" },
        { name: "mobile", label: "Cellulare", type: "tel" },
        { name: "notes", label: "Note", type: "textarea", colSpan: 2 },
      ],
    },
  ];
}

/** Campi testuali usati per il mapping FormData → riga (esclude company/is_primary). */
export const CONTACT_TEXT_FIELDS: FieldConfig[] = [
  { name: "full_name", label: "Nome completo", required: true },
  { name: "role", label: "Ruolo" },
  { name: "email", label: "Email", type: "email" },
  { name: "phone", label: "Telefono", type: "tel" },
  { name: "mobile", label: "Cellulare", type: "tel" },
  { name: "notes", label: "Note", type: "textarea" },
];
