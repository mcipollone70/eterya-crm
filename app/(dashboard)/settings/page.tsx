import { SettingsPage } from "@/features/settings";

export const metadata = { title: "Impostazioni" };

interface PageProps {
  searchParams?: Promise<{
    google_calendar?: string;
    message?: string;
  }>;
}

export default async function Page({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};

  return (
    <SettingsPage
      google_calendar={params.google_calendar}
      message={params.message}
    />
  );
}
