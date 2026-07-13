import { CompaniesPage } from "@/features/companies/components/companies-page";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Aziende",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ commercial_status?: string }>;
}) {
  const { commercial_status } = await searchParams;
  return <CompaniesPage commercialStatus={commercial_status} />;
}
