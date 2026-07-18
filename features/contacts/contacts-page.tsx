import Link from "next/link";
import { Suspense } from "react";
import { Plus, Users } from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { ContactsPagination } from "./components/contacts-pagination";
import {
  formatContactsVisibleRange,
  parseContactsPage,
  parseContactsPageSize,
} from "./constants/contacts-pagination";
import { listContacts } from "./services/contacts.service";
import { BrandBadges } from "@/features/brands/components/brand-badges";
import { BrandFilter } from "@/features/brands/components/brand-filter";
import { fetchCompanyBrandsByCompanyIds } from "@/features/brands/services/company-brands-batch.service";
import { listBrands } from "@/features/brands/services/brands.service";
import {
  parseBrandMatchMode,
  parseBrandsUrlParam,
} from "@/features/brands/utils/brand-shared";

interface ContactsPageProps {
  page?: string;
  pageSize?: string;
  brands?: string;
  brandMode?: string;
}

function CreateCta() {
  return (
    <Link
      href="/contacts/new"
      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
    >
      <Plus className="h-4 w-4" />
      Nuovo contatto
    </Link>
  );
}

export async function ContactsPage({
  page,
  pageSize,
  brands,
  brandMode,
}: ContactsPageProps) {
  const requestedPage = parseContactsPage(page);
  const requestedPageSize = parseContactsPageSize(pageSize);
  const brandSlugs = parseBrandsUrlParam(brands);
  const brandMatchMode = parseBrandMatchMode(brandMode);

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Contatti" subtitle="Referenti delle aziende." actions={<CreateCta />} />
        <EmptyState
          icon={Users}
          title="Database non configurato"
          message="Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local e riavvia il server per gestire i contatti."
        />
      </div>
    );
  }

  const [{ data: contacts, count, page: currentPage, error }, brandsResult] =
    await Promise.all([
      listContacts({
        page: requestedPage,
        pageSize: requestedPageSize,
        brandSlugs,
        brandMatchMode,
      }),
      listBrands({ activeOnly: true }),
    ]);

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Contatti" subtitle="Referenti delle aziende." actions={<CreateCta />} />
        <EmptyState icon={Users} title="Impossibile caricare i contatti" message={error} />
      </div>
    );
  }

  if (count === 0 && brandSlugs.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Contatti"
          subtitle="Nessun contatto presente nel database."
          actions={<CreateCta />}
        />
        <EmptyState
          icon={Users}
          title="Nessun contatto"
          message="Crea il primo referente collegandolo a un'azienda esistente."
          action={<CreateCta />}
        />
      </div>
    );
  }

  const companyIds = Array.from(new Set(contacts.map((c) => c.company_id)));
  const brandsByCompany = await fetchCompanyBrandsByCompanyIds(companyIds);
  const brandOptions = (brandsResult.data ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    color: b.color,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contatti"
        subtitle={`${formatContactsVisibleRange(currentPage, requestedPageSize, count)}${
          brandSlugs.length > 0 ? " · filtro brand attivo" : ""
        }`}
        actions={<CreateCta />}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Suspense fallback={null}>
          <BrandFilter
            brands={brandOptions}
            basePath="/contacts"
          />
        </Suspense>
      </div>

      {contacts.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nessun risultato"
          message="Nessun contatto corrisponde al filtro brand selezionato."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Nome</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Azienda</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Brand</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Ruolo</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Email</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Telefono</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((contact) => (
                    <tr
                      key={
                        contact.fromCompanyReferent
                          ? `company-ref-${contact.company_id}`
                          : contact.id
                      }
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 font-medium text-indigo-600">
                        <span className="flex items-center gap-2">
                          {contact.fromCompanyReferent ? (
                            <Link
                              href={`/companies/${contact.company_id}`}
                              className="hover:underline"
                            >
                              {contact.full_name}
                            </Link>
                          ) : (
                            <Link href={`/contacts/${contact.id}`} className="hover:underline">
                              {contact.full_name}
                            </Link>
                          )}
                          {contact.is_primary && <Badge variant="info">Principale</Badge>}
                          {contact.fromCompanyReferent && (
                            <Badge variant="muted">Da anagrafica</Badge>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <Link
                          href={`/companies/${contact.company_id}`}
                          className="hover:underline"
                        >
                          {contact.company?.name ?? "—"}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <BrandBadges
                          brands={brandsByCompany.byCompanyId.get(contact.company_id) ?? []}
                          compact
                        />
                      </td>
                      <td className="px-4 py-3 text-slate-700">{contact.role || "—"}</td>
                      <td className="px-4 py-3 text-slate-700">{contact.email || "—"}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {contact.phone || contact.mobile || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Suspense fallback={null}>
              <ContactsPagination
                total={count}
                page={currentPage}
                pageSize={requestedPageSize}
              />
            </Suspense>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
