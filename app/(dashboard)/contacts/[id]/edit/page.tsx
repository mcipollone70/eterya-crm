import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  ContactForm,
  getContactById,
  updateContactAction,
} from "@/features/contacts";

export const dynamic = "force-dynamic";

export const metadata = { title: "Modifica contatto" };

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Modifica contatto" />
        <EmptyState
          icon={Users}
          title="Database non configurato"
          message="Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local e riavvia il server per modificare il contatto."
        />
      </div>
    );
  }

  const { data: contact, error } = await getContactById(id);

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Modifica contatto" />
        <EmptyState icon={Users} title="Impossibile caricare il contatto" message={error} />
      </div>
    );
  }

  if (!contact) {
    notFound();
  }

  const defaults = {
    company_id: contact.company_id,
    full_name: contact.full_name,
    role: contact.role,
    email: contact.email,
    phone: contact.phone,
    mobile: contact.mobile,
    notes: contact.notes,
    is_primary: contact.is_primary ? "true" : "false",
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Modifica contatto" subtitle={contact.full_name} />
      <ContactForm
        action={updateContactAction.bind(null, id)}
        submitLabel="Salva modifiche"
        cancelHref={`/contacts/${id}`}
        defaults={defaults}
      />
    </div>
  );
}
