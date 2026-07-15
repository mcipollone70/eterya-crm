import { ContactsPage } from "@/features/contacts";

export const dynamic = "force-dynamic";

export const metadata = { title: "Contatti" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    page_size?: string;
  }>;
}) {
  const { page, page_size } = await searchParams;

  return <ContactsPage page={page} pageSize={page_size} />;
}
