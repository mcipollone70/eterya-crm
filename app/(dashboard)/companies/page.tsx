import { CompaniesPage } from "@/features/companies/components/companies-page";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Aziende",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    commercial_status?: string;
    priority_tier?: string;
    last_visit?: string;
    sort?: string;
    product_family?: string;
    interest_level?: string;
    purchased_product?: string;
    brands?: string;
    brand_mode?: string;
    page?: string;
    page_size?: string;
  }>;
}) {
  const {
    commercial_status,
    priority_tier,
    last_visit,
    sort,
    product_family,
    interest_level,
    purchased_product,
    brands,
    brand_mode,
    page,
    page_size,
  } = await searchParams;
  return (
    <CompaniesPage
      commercialStatus={commercial_status}
      priorityTier={priority_tier}
      lastVisit={last_visit}
      sort={sort}
      productFamily={product_family}
      interestLevel={interest_level}
      purchasedProduct={purchased_product}
      brands={brands}
      brandMode={brand_mode}
      page={page}
      pageSize={page_size}
    />
  );
}
