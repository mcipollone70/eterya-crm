"use client";

import Link from "next/link";
import { KeyRound, Pencil, UserX } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import {
  getUserRoleBadgeVariant,
  getUserRoleLabel,
} from "../constants/user-roles";
import type { AdminUserListItem } from "../types";
import { formatDate, formatRelativeDate } from "@/utils/format";

interface AdminUsersTableProps {
  users: AdminUserListItem[];
}

function formatLastAccess(value: string | null): string {
  if (!value) return "—";
  return formatRelativeDate(value);
}

export function AdminUsersTable({ users }: AdminUsersTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-xs font-semibold text-slate-500">Nome</th>
            <th className="px-4 py-3 text-xs font-semibold text-slate-500">Email</th>
            <th className="px-4 py-3 text-xs font-semibold text-slate-500">Ruolo</th>
            <th className="px-4 py-3 text-xs font-semibold text-slate-500">Stato</th>
            <th className="px-4 py-3 text-xs font-semibold text-slate-500">Ultimo accesso</th>
            <th className="px-4 py-3 text-xs font-semibold text-slate-500">Creato</th>
            <th className="px-4 py-3 text-xs font-semibold text-slate-500">Aziende</th>
            <th className="px-4 py-3 text-xs font-semibold text-slate-500">Azioni</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr
              key={user.id}
              className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
            >
              <td className="px-4 py-3 font-medium text-slate-900">
                {user.fullName || "—"}
              </td>
              <td className="px-4 py-3 text-slate-700">{user.email}</td>
              <td className="px-4 py-3">
                <Badge variant={getUserRoleBadgeVariant(user.role)}>
                  {getUserRoleLabel(user.role)}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <Badge variant={user.isActive ? "success" : "danger"}>
                  {user.isActive ? "Attivo" : "Disattivo"}
                </Badge>
              </td>
              <td className="px-4 py-3 text-slate-600" title={user.lastSignInAt ?? undefined}>
                {formatLastAccess(user.lastSignInAt)}
              </td>
              <td className="px-4 py-3 text-slate-600">{formatDate(user.createdAt)}</td>
              <td className="px-4 py-3 text-slate-600">{user.assignedCompaniesCount}</td>
              <td className="px-4 py-3">
                <Link href={`/admin/users/${user.id}/edit`}>
                  <Button type="button" variant="outline" size="sm">
                    <Pencil className="h-3.5 w-3.5" />
                    Modifica
                  </Button>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminUserQuickActionsHint() {
  return (
    <p className="text-xs text-slate-500">
      Dalla pagina di modifica puoi inviare reset password{" "}
      <KeyRound className="inline h-3 w-3" /> o disattivare l&apos;utente{" "}
      <UserX className="inline h-3 w-3" />.
    </p>
  );
}
