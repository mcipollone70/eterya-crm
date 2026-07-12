import { CompaniesPage } from "@/features/companies/components/companies-page";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Aziende",
};

export default function Page() {
  return <CompaniesPage />;
}
