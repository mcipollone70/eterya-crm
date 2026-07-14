import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/components/login-form";
import { getCurrentUser } from "@/features/auth/session";
import { resolvePostLoginRedirect } from "@/features/auth/utils/post-login-redirect";
import { canShowSignupButton } from "@/features/auth/utils/signup-policy";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = {
  title: "Accedi",
};

interface LoginPageProps {
  searchParams: Promise<{ invite?: string; redirectedFrom?: string; reset?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const redirectedFrom = params.redirectedFrom?.trim() || null;
  const resetSuccess = params.reset === "success";

  const user = await getCurrentUser();
  if (user) {
    redirect(resolvePostLoginRedirect(redirectedFrom));
  }

  const inviteCode = params.invite?.trim() || null;

  return (
    <LoginForm
      configured={isSupabaseConfigured()}
      showSignup={canShowSignupButton(inviteCode)}
      inviteCode={inviteCode}
      redirectedFrom={redirectedFrom}
      resetSuccess={resetSuccess}
    />
  );
}
