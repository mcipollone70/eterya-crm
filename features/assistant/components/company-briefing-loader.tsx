import { EmptyState } from "@/components/ui";
import { Sparkles } from "lucide-react";
import { getCompanyVisitBriefing } from "../services/company-briefing.service";
import { CompanyVisitBriefingPanel } from "./company-visit-briefing-panel";

interface CompanyBriefingLoaderProps {
  companyId: string;
  backHref?: string;
  backLabel?: string;
}

export async function CompanyBriefingLoader({
  companyId,
  backHref,
  backLabel,
}: CompanyBriefingLoaderProps) {
  const { data, error } = await getCompanyVisitBriefing(companyId);

  if (error || !data) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Briefing non disponibile"
        message={error ?? "Impossibile caricare il briefing per questa azienda."}
      />
    );
  }

  return (
    <CompanyVisitBriefingPanel
      briefing={data}
      backHref={backHref}
      backLabel={backLabel}
    />
  );
}
