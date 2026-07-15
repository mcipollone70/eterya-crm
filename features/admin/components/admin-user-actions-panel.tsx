"use client";

import { useState, useTransition } from "react";
import { KeyRound, Loader2, UserX } from "lucide-react";
import { Button } from "@/components/ui";
import {
  deactivateAdminUserAction,
  sendPasswordResetAction,
} from "../actions/admin-user-actions";

interface AdminUserActionsPanelProps {
  userId: string;
  email: string;
  isActive: boolean;
  isSelf: boolean;
}

export function AdminUserActionsPanel({
  userId,
  email,
  isActive,
  isSelf,
}: AdminUserActionsPanelProps) {
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [deactivateMessage, setDeactivateMessage] = useState<string | null>(null);
  const [resetPending, startReset] = useTransition();
  const [deactivatePending, startDeactivate] = useTransition();

  const handleReset = () => {
    setResetMessage(null);
    setResetError(null);
    startReset(async () => {
      const result = await sendPasswordResetAction(userId, email);
      if (result.error) {
        setResetError(result.error);
      } else {
        setResetMessage(result.message ?? "Email di reset inviata.");
      }
    });
  };

  const handleDeactivate = () => {
    if (
      !window.confirm(
        `Disattivare l'utente ${email}? Non potrà più accedere. Visite, aziende e opportunità resteranno collegate.`
      )
    ) {
      return;
    }

    setDeactivateMessage(null);
    setDeactivateError(null);
    startDeactivate(async () => {
      const result = await deactivateAdminUserAction(userId);
      if (result.error) {
        setDeactivateError(result.error);
      } else {
        setDeactivateMessage(result.message ?? "Utente disattivato.");
      }
    });
  };

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-900">Azioni sensibili</h3>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
          disabled={resetPending || !isActive}
        >
          {resetPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <KeyRound className="h-4 w-4" />
          )}
          Invia reset password
        </Button>

        {!isSelf && isActive && (
          <Button
            type="button"
            variant="danger"
            onClick={handleDeactivate}
            disabled={deactivatePending}
          >
            {deactivatePending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserX className="h-4 w-4" />
            )}
            Disattiva utente
          </Button>
        )}
      </div>

      {resetMessage && <p className="text-sm text-emerald-700">{resetMessage}</p>}
      {resetError && <p className="text-sm text-red-600">{resetError}</p>}
      {deactivateMessage && (
        <p className="text-sm text-emerald-700">{deactivateMessage}</p>
      )}
      {deactivateError && <p className="text-sm text-red-600">{deactivateError}</p>}

      {isSelf && (
        <p className="text-xs text-slate-500">
          Non puoi disattivare il tuo account da qui.
        </p>
      )}
    </div>
  );
}
