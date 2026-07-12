import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/components/login-form";
import { getCurrentUser } from "@/features/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = {
  title: "Accedi",
};

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/");
  }

  return <LoginForm configured={isSupabaseConfigured()} />;
}
