export const dynamic = "force-dynamic";

import { DocumentsPage } from "@/features/documents";

export const metadata = { title: "Gestione Documenti" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string }>;
}) {
  const { type, q } = await searchParams;

  return <DocumentsPage type={type} q={q} />;
}
