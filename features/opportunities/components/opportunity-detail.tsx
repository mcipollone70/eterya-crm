import Link from "next/link";
import {
  Building2,
  CalendarPlus,
  Pencil,
  Phone,
  Sparkles,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DeleteButton,
  DescriptionItem,
  DescriptionList,
  PageHeader,
} from "@/components/ui";
import {
  CLOSED_LOST_STAGE,
  CLOSED_WON_STAGE,
  formatOpportunityAmount,
  isOpenOpportunityStage,
  OPPORTUNITY_STAGE_LABELS,
} from "@/lib/constants/opportunity-pipeline";
import { PRODUCT_FAMILY_LABELS } from "@/lib/constants/product-catalog";
import { formatVisitDate } from "@/lib/last-visit/format";
import type { Contact } from "@/features/contacts/services/contacts.service";
import type { Tables } from "@/lib/supabase/types";
import { deleteOpportunityAction } from "../actions/opportunity-actions";
import { OpportunityCloseButton } from "./opportunity-close-button";
import { OpportunityMobileActionBar } from "./opportunity-mobile-action-bar";
import { OpportunityRelatedActivitiesSection } from "./opportunity-related-activities-section";
import { OpportunityRelatedProductsSection } from "./opportunity-related-products-section";
import { OpportunityStageControl } from "./opportunity-stage-control";
import { OpportunityStageHistorySection } from "./opportunity-stage-history-section";
import type { OpportunityListItem } from "../services/opportunities.service";

type CompanyRow = Tables<"companies">;

function resolveCallHref(contact: Contact | null, company: CompanyRow): string | null {
  const candidates = [
    contact?.mobile,
    contact?.phone,
    company.mobile,
    company.contact_phone,
    company.phone,
    company.phone_secondary,
  ].filter((value): value is string => Boolean(value?.trim()));

  const phone = candidates[0]?.trim();
  if (!phone) {
    return null;
  }

  return `tel:${phone.replace(/\s+/g, "")}`;
}

function stageVariant(stage: OpportunityListItem["stage"]) {
  if (stage === CLOSED_WON_STAGE) {
    return "success" as const;
  }
  if (stage === CLOSED_LOST_STAGE) {
    return "danger" as const;
  }
  return "info" as const;
}

interface OpportunityDetailProps {
  opportunity: OpportunityListItem;
  company: CompanyRow;
  contact: Contact | null;
}

export function OpportunityDetail({
  opportunity,
  company,
  contact,
}: OpportunityDetailProps) {
  const callHref = resolveCallHref(contact, company);
  const isClosed =
    opportunity.stage === CLOSED_WON_STAGE || opportunity.stage === CLOSED_LOST_STAGE;

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <PageHeader
        title={opportunity.title}
        subtitle={opportunity.company_name ?? "Opportunità commerciale"}
        actions={
          <>
            <Link href={`/opportunities/${opportunity.id}/edit`}>
              <Button variant="outline" size="sm">
                <Pencil className="h-4 w-4" />
                Modifica
              </Button>
            </Link>
            <DeleteButton
              action={deleteOpportunityAction.bind(
                null,
                opportunity.id,
                opportunity.company_id
              )}
              confirmMessage={`Eliminare l'opportunità "${opportunity.title}"?`}
            />
          </>
        }
      />

      <div className="hidden flex-wrap gap-2 lg:flex">
        {callHref ? (
          <a href={callHref}>
            <Button size="sm">
              <Phone className="h-4 w-4" />
              Chiama
            </Button>
          </a>
        ) : (
          <Button size="sm" variant="outline" disabled>
            <Phone className="h-4 w-4" />
            Chiama
          </Button>
        )}
        <Link href={`/visits?company=${opportunity.company_id}`}>
          <Button size="sm" variant="outline">
            <CalendarPlus className="h-4 w-4" />
            Pianifica visita
          </Button>
        </Link>
        <Link href={`/companies/${opportunity.company_id}`}>
          <Button size="sm" variant="outline">
            <Building2 className="h-4 w-4" />
            Apri azienda
          </Button>
        </Link>
        <Link href={`/visits?company=${opportunity.company_id}&briefing=${opportunity.company_id}`}>
          <Button size="sm" variant="outline">
            <Sparkles className="h-4 w-4" />
            Apri briefing
          </Button>
        </Link>
        <OpportunityCloseButton
          opportunityId={opportunity.id}
          companyId={opportunity.company_id}
          isClosed={isClosed}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
            <CardTitle>Dettaglio opportunità</CardTitle>
            <Badge variant={stageVariant(opportunity.stage)}>
              {OPPORTUNITY_STAGE_LABELS[opportunity.stage]}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <DescriptionList>
              <DescriptionItem
                label="Azienda"
                value={
                  <Link
                    href={`/companies/${opportunity.company_id}`}
                    className="text-indigo-600 hover:underline"
                  >
                    {opportunity.company_name ?? "—"}
                  </Link>
                }
              />
              <DescriptionItem
                label="Referente"
                value={
                  opportunity.contact_id ? (
                    <Link
                      href={`/contacts/${opportunity.contact_id}`}
                      className="text-indigo-600 hover:underline"
                    >
                      {opportunity.contact_name ?? "—"}
                    </Link>
                  ) : (
                    opportunity.contact_name
                  )
                }
              />
              <DescriptionItem
                label="Valore stimato"
                value={formatOpportunityAmount(opportunity.total_amount, opportunity.currency)}
              />
              <DescriptionItem
                label="Probabilità"
                value={opportunity.probability != null ? `${opportunity.probability}%` : "—"}
              />
              <DescriptionItem
                label="Famiglia prodotto"
                value={PRODUCT_FAMILY_LABELS[opportunity.product_family]}
              />
              <DescriptionItem
                label="Interesse prodotto"
                value={opportunity.product_interest}
                span
              />
              <DescriptionItem
                label="Chiusura prevista"
                value={
                  opportunity.expected_close_at
                    ? new Date(opportunity.expected_close_at).toLocaleDateString("it-IT")
                    : null
                }
              />
              <DescriptionItem
                label="Aperta il"
                value={formatVisitDate(opportunity.opened_at)}
              />
              <DescriptionItem label="Note" value={opportunity.notes} span />
            </DescriptionList>

            <OpportunityStageControl
              opportunityId={opportunity.id}
              companyId={opportunity.company_id}
              currentStage={opportunity.stage}
            />

            {isOpenOpportunityStage(opportunity.stage) && (
              <div className="lg:hidden">
                <OpportunityCloseButton
                  opportunityId={opportunity.id}
                  companyId={opportunity.company_id}
                  isClosed={false}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Collegamenti rapidi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-2 text-sm">
            <p>
              <span className="font-medium text-slate-700">Azienda: </span>
              <Link
                href={`/companies/${opportunity.company_id}`}
                className="text-indigo-600 hover:underline"
              >
                {company.name}
              </Link>
            </p>
            {contact && (
              <p>
                <span className="font-medium text-slate-700">Contatto: </span>
                <Link
                  href={`/contacts/${contact.id}`}
                  className="text-indigo-600 hover:underline"
                >
                  {contact.full_name}
                </Link>
              </p>
            )}
            {opportunity.product_names.length > 0 && (
              <div>
                <p className="font-medium text-slate-700">Prodotti</p>
                <ul className="mt-1 list-inside list-disc text-slate-600">
                  {opportunity.product_names.map((name, index) => (
                    <li key={opportunity.product_ids[index] ?? `${name}-${index}`}>{name}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-slate-500">
              Creata {formatVisitDate(opportunity.created_at)} · Aggiornata{" "}
              {formatVisitDate(opportunity.updated_at)}
            </p>
          </CardContent>
        </Card>
      </div>

      <OpportunityRelatedProductsSection opportunity={opportunity} />
      <OpportunityRelatedActivitiesSection companyId={opportunity.company_id} />
      <OpportunityStageHistorySection opportunityId={opportunity.id} />

      <OpportunityMobileActionBar
        companyId={opportunity.company_id}
        callHref={callHref}
      />
    </div>
  );
}
