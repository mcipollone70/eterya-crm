import { Package } from "lucide-react";
import { PagePlaceholder } from "@/components/ui";

export function ProductsPage() {
  return (
    <PagePlaceholder
      title="Prodotti"
      description="Cataloga i prodotti e gestisci i listini prezzi."
      icon={Package}
    />
  );
}
