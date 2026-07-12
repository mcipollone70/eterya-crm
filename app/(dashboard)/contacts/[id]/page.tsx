import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { ContactDetail, getContactById } from "@/features/contacts";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dettaglio contatto" };

export default async function ContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dettaglio contatto" />
        <EmptyState
          icon={Users}
          title="Database non configurato"
          message="Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local e riavvia il server per consultare il contatto."
        />
      </div>
    );
  }

  const { data: contact, error } = await getContactById(id);

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dettaglio contatto" />
        <EmptyState icon={Users} title="Impossibile caricare il contatto" message={error} />
      </div>
    );
  }

  if (!contact) {
    notFound();
  }

  return <ContactDetail contact={contact} />;
}
