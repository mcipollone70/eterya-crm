import { PageHeader } from "@/components/ui";
import { ContactForm, createContactAction } from "@/features/contacts";

export const dynamic = "force-dynamic";

export const metadata = { title: "Nuovo contatto" };

export default async function NewContactPage({
  searchParams,
}: {
  searchParams: Promise<{ company_id?: string }>;
}) {
  const { company_id } = await searchParams;

  return (
    <div className="space-y-6">
      <PageHeader title="Nuovo contatto" subtitle="Aggiungi un referente a un'azienda." />
      <ContactForm
        action={createContactAction}
        submitLabel="Crea contatto"
        cancelHref="/contacts"
        defaults={{ is_primary: "false", company_id: company_id ?? "" }}
      />
    </div>
  );
}
