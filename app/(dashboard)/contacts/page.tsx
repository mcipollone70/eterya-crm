import { ContactsPage } from "@/features/contacts";

export const dynamic = "force-dynamic";

export const metadata = { title: "Contatti" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    page_size?: string;
    brands?: string;
    brand_mode?: string;
  }>;
}) {
  const { page, page_size, brands, brand_mode } = await searchParams;

  return (
    <ContactsPage
      page={page}
      pageSize={page_size}
      brands={brands}
      brandMode={brand_mode}
    />
  );
}
