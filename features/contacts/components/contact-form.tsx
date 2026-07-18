import { Users } from "lucide-react";
import { EmptyState, EntityForm } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { FormState } from "@/lib/forms";
import { buildContactSections } from "../utils/contact-fields";

interface ContactFormProps {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  cancelHref: string;
  defaults?: Record<string, string | number | null | undefined>;
}

/**
 * Wrapper server del form contatto. Condiviso tra le pagine di creazione e modifica.
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

  return (
    <EntityForm
      sections={buildContactSections()}
      action={action}
      submitLabel={submitLabel}
      cancelHref={cancelHref}
      defaults={defaults}
    />
  );
}
