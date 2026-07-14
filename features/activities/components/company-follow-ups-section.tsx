import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { ContactListItem } from "@/features/contacts/services/contacts.service";
import { FollowUpList } from "./follow-up-list";
import { NewFollowUpForm } from "./new-follow-up-form";
import { listFollowUps } from "../services/follow-ups.service";

interface CompanyFollowUpsSectionProps {
  companyId: string;
  contacts: ContactListItem[];
}

export async function CompanyFollowUpsSection({
  companyId,
  contacts,
}: CompanyFollowUpsSectionProps) {
  const { data: items, error } = await listFollowUps({
    companyId,
    limit: 100,
  });

  const openItems = items.filter(
    (item) => item.status === "todo" || item.status === "postponed"
  );

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>Follow-up e promemoria ({openItems.length} aperti)</CardTitle>
        <NewFollowUpForm companyId={companyId} contacts={contacts} />
      </CardHeader>
      <CardContent className="space-y-4 pt-2">
        {error && <p className="text-sm text-rose-700">{error}</p>}
        <FollowUpList
          items={items}
          title="Elenco follow-up"
          showCompany={false}
          emptyMessage="Nessun follow-up per questa azienda. Crea il primo promemoria."
        />
      </CardContent>
    </Card>
  );
}
