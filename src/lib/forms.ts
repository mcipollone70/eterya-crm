/**
 * Primitivi condivisi per i form CRUD guidati da configurazione.
 * Un'unica definizione dei campi alimenta sia il rendering (EntityForm) sia il
 * mapping FormData → riga DB, evitando duplicazioni tra i moduli (companies,
 * contacts, ...).
 */

export type FieldType =
  | "text"
  | "email"
  | "tel"
  | "url"
  | "number"
  | "date"
  | "textarea"
  | "select"
  | "company_select";

export interface SelectOption {
  value: string;
  label: string;
}

export interface FieldConfig {
  name: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: SelectOption[];
  /** 2 = occupa l'intera riga della griglia a due colonne. */
  colSpan?: 1 | 2;
  rows?: number;
}

export interface FormSection {
  title?: string;
  description?: string;
  fields: FieldConfig[];
}

/** Stato restituito dalle Server Action dei form, consumato via `useActionState`. */
export interface FormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export function flattenFields(sections: FormSection[]): FieldConfig[] {
  return sections.flatMap((section) => section.fields);
}

function getTrimmed(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

/** Numero oppure `null` per valori vuoti/non validi (accetta la virgola decimale). */
function getNumeric(formData: FormData, name: string): number | null {
  const raw = getTrimmed(formData, name);
  if (raw.length === 0) return null;
  const parsed = Number(raw.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Converte i valori del form in un record pronto per l'insert/update:
 * campi vuoti opzionali → `null`, campi numerici → number|null, required → stringa.
 */
export function formDataToRecord(
  formData: FormData,
  fields: FieldConfig[]
): Record<string, string | number | null> {
  const record: Record<string, string | number | null> = {};

  for (const field of fields) {
    if (field.type === "number") {
      record[field.name] = getNumeric(formData, field.name);
      continue;
    }

    const value = getTrimmed(formData, field.name);
    if (field.required) {
      record[field.name] = value;
    } else {
      record[field.name] = value.length > 0 ? value : null;
    }
  }

  return record;
}

/** Verifica i campi `required`; ritorna la mappa errori o `null` se tutto valido. */
export function validateRequired(
  formData: FormData,
  fields: FieldConfig[]
): Record<string, string> | null {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    if (field.required && getTrimmed(formData, field.name).length === 0) {
      errors[field.name] = `${field.label} è obbligatorio.`;
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

/** Estrae dai dati di una riga i soli valori dei campi del form (default per edit). */
export function pickDefaults(
  source: Record<string, unknown>,
  fields: FieldConfig[]
): Record<string, string | number | null> {
  const defaults: Record<string, string | number | null> = {};

  for (const field of fields) {
    const value = source[field.name];
    if (typeof value === "number") {
      defaults[field.name] = value;
    } else if (value === null || value === undefined) {
      defaults[field.name] = null;
    } else if (typeof value === "boolean") {
      defaults[field.name] = value ? "true" : "false";
    } else {
      defaults[field.name] = String(value);
    }
  }

  return defaults;
}
