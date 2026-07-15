import { EditAdminUserPage } from "@/features/admin";

export const dynamic = "force-dynamic";

export const metadata = { title: "Modifica utente" };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;

  return <EditAdminUserPage userId={id} created={created} />;
}
