import Link from "next/link";
import { Users } from "lucide-react";
import { Button, EmptyState, EntityForm } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { FormState } from "@/lib/forms";
import { listCompanyOptions } from "../services/contacts.service";
import { buildContactSections } from "../utils/contact-fields";

interface ContactFormProps {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  cancelHref: string;
  defaults?: Record<string, string | number | null | undefined>;
}

/**
 * Wrapper server del form contatto: carica le opzioni azienda per la select e
 * gestisce il degrado grazioso (DB non configurato / nessuna azienda). Condiviso
 * tra le pagine di creazione e modifica.
 */
export async function ContactForm({
  action,
  submitLabel,
  cancelHref,
  defaults,
}: ContactFormProps) {
  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        icon={Users}
        title="Database non configurato"
        message="Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local e riavvia il server per gestire i contatti."
      />
    );
  }

  const includeCompanyId =
    defaults?.company_id !== null &&
    defaults?.company_id !== undefined &&
    String(defaults.company_id).trim() !== ""
      ? String(defaults.company_id)
      : undefined;

  const { options, error } = await listCompanyOptions(500, includeCompanyId);

  if (error) {
    return (
      <EmptyState icon={Users} title="Impossibile caricare le aziende" message={error} />
    );
  }

  if (options.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Nessuna azienda disponibile"
        message="Un contatto deve essere collegato a un'azienda. Crea prima un'azienda."
        action={
          <Link href="/companies/new">
            <Button>Crea azienda</Button>
          </Link>
        }
      />
    );
  }

  return (
    <EntityForm
      sections={buildContactSections(options)}
      action={action}
      submitLabel={submitLabel}
      cancelHref={cancelHref}
      defaults={defaults}
    />
  );
}
