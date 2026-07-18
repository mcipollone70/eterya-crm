import { redirect } from "next/navigation";

/** Compatibilità link esistenti — reindirizza alla route canonica. */
export default function Page() {
  redirect("/giro-visite");
}
