import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { getCurrentUser } from "@/features/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = {
  title: "Reimposta password",
};

interface ResetPasswordPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;
  const initialError = params.error?.trim() || null;
  const user = await getCurrentUser();

  return (
    <ResetPasswordForm
      configured={isSupabaseConfigured()}
      hasRecoverySession={Boolean(user)}
      initialError={initialError}
    />
  );
}
