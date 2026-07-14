import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/components/login-form";
import { getCurrentUser } from "@/features/auth/session";
import { canShowSignupButton } from "@/features/auth/utils/signup-policy";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = {
  title: "Accedi",
};

interface LoginPageProps {
  searchParams: Promise<{ invite?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();
  if (user) {
    redirect("/");
  }

  const { invite } = await searchParams;
  const inviteCode = invite?.trim() || null;

  return (
    <LoginForm
      configured={isSupabaseConfigured()}
      showSignup={canShowSignupButton(inviteCode)}
      inviteCode={inviteCode}
    />
  );
}
