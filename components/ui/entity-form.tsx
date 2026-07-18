"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { cn } from "@/utils/cn";
import { CompanySelect } from "@/features/companies/components/company-select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./card";
import { Button } from "./button";
import type { FieldConfig, FormSection, FormState } from "@/lib/forms";

const controlClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30";

type FieldDefaults = Record<string, string | number | null | undefined>;

function toDefaultValue(
  defaults: FieldDefaults | undefined,
  name: string
): string {
  const value = defaults?.[name];
  return value === null || value === undefined ? "" : String(value);
}

function inputType(type: FieldConfig["type"]): string {
  switch (type) {
    case "email":
    case "tel":
    case "url":
    case "number":
    case "date":
      return type;
    default:
      return "text";
  }
}

function CompanySelectField({
  field,
  defaultValue,
}: {
  field: FieldConfig;
  defaultValue: string;
}) {
  const [companyId, setCompanyId] = useState(defaultValue);

  return (
    <CompanySelect
      name={field.name}
      value={companyId}
      onChange={setCompanyId}
      required={field.required}
      placeholder={field.placeholder ?? "Seleziona azienda"}
      allowEmpty={!field.required}
      emptyLabel={field.placeholder ?? "Seleziona azienda"}
    />
  );
}

function FieldControl({
  field,
  defaultValue,
}: {
  field: FieldConfig;
  defaultValue: string;
}) {
  const shared = {
    id: field.name,
    name: field.name,
    required: field.required,
    placeholder: field.placeholder,
    defaultValue,
  };

  if (field.type === "company_select") {
    return <CompanySelectField field={field} defaultValue={defaultValue} />;
  }

  if (field.type === "textarea") {
    return (
      <textarea {...shared} rows={field.rows ?? 3} className={cn(controlClass, "resize-y")} />
    );
  }

  if (field.type === "select") {
    return (
      <select {...shared} className={controlClass}>
        {!field.required && <option value="">—</option>}
        {field.options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      {...shared}
      type={inputType(field.type)}
      step={field.type === "number" ? "any" : undefined}
      className={controlClass}
    />
  );
}

interface EntityFormProps {
  sections: FormSection[];
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  cancelHref: string;
  defaults?: FieldDefaults;
}

/**
 * Form CRUD generico guidato da configurazione, condiviso tra i moduli.
 * Riceve una Server Action (create o update già "bindata" con l'id) e gestisce
 * errori globali e per-campo tramite `useActionState`.
 */
export function EntityForm({
  sections,
  action,
  submitLabel,
  cancelHref,
  defaults,
}: EntityFormProps) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {}
  );

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      {sections.map((section, index) => (
        <Card key={section.title ?? index}>
          {section.title && (
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
              {section.description && (
                <CardDescription>{section.description}</CardDescription>
              )}
            </CardHeader>
          )}
          <CardContent
            className={cn(
              "grid grid-cols-1 gap-4 sm:grid-cols-2",
              section.title ? "pt-4" : "pt-5"
            )}
          >
            {section.fields.map((field) => {
              const fieldError = state.fieldErrors?.[field.name];
              return (
                <div
                  key={field.name}
                  className={field.colSpan === 2 ? "sm:col-span-2" : undefined}
                >
                  <label
                    htmlFor={field.name}
                    className="mb-1 block text-sm font-medium text-slate-700"
                  >
                    {field.label}
                    {field.required && <span className="text-red-500"> *</span>}
                  </label>
                  <FieldControl
                    field={field}
                    defaultValue={toDefaultValue(defaults, field.name)}
                  />
                  {fieldError && (
                    <p className="mt-1 text-xs text-red-600">{fieldError}</p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      <div className="flex items-center justify-end gap-3">
        <Link href={cancelHref}>
          <Button type="button" variant="outline">
            Annulla
          </Button>
        </Link>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvataggio…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
