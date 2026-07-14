import { JoyAutonomousPage } from "@/features/joy/joy-autonomous-page";

interface PageProps {
  searchParams?: Promise<{
    focus?: string;
  }>;
}

export default function Page({ searchParams }: PageProps) {
  return <JoyAutonomousPage searchParams={searchParams} />;
}
