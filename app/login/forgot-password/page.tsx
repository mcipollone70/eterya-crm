import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = {
  title: "Password dimenticata",
};

interface ForgotPasswordPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const params = await searchParams;
  const initialError = params.error?.trim() || null;

  return (
    <ForgotPasswordForm
      configured={isSupabaseConfigured()}
      initialError={initialError}
    />
  );
}
