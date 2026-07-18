"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { CompanySelect } from "@/features/companies/components/company-select";
import {
  SERVICE_TICKET_CATEGORY_OPTIONS,
  SERVICE_TICKET_PRIORITY_OPTIONS,
  SERVICE_TICKET_STATUS_OPTIONS,
} from "@/lib/constants/service-tickets";
import type { ActivityPriority, ServiceTicketStatus } from "@/lib/supabase/types";
import type { ProductListItem } from "@/features/products/services/products.service";
import {
  saveServiceTicketAction,
  updateServiceTicketAction,
} from "../actions/service-ticket-actions";
import type { ServiceTicketListItem } from "../services/service-tickets.service";

interface ServiceTicketFormProps {
  products: ProductListItem[];
  ticket?: ServiceTicketListItem;
  initialCompanyId?: string;
  initialOrderId?: string;
}

export function ServiceTicketForm({
  products,
  ticket,
  initialCompanyId,
  initialOrderId,
}: ServiceTicketFormProps) {
  const router = useRouter();
  const isEdit = Boolean(ticket);
  const [companyId, setCompanyId] = useState(ticket?.company_id ?? initialCompanyId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!companyId) {
      setError("Seleziona l'azienda del ticket.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const scheduledRaw = String(formData.get("scheduled_at") ?? "");

    const payload = {
      companyId,
      productId: String(formData.get("product_id") ?? "") || null,
      orderId: String(formData.get("order_id") ?? "") || null,
      number: String(formData.get("number") ?? "") || null,
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? "") || null,
      category: String(formData.get("category") ?? "assistenza"),
      status: String(formData.get("status") ?? "aperto") as ServiceTicketStatus,
      priority: String(formData.get("priority") ?? "medium") as ActivityPriority,
      scheduledAt: scheduledRaw ? new Date(scheduledRaw).toISOString() : null,
      resolution: String(formData.get("resolution") ?? "") || null,
    };

    startTransition(async () => {
      if (isEdit && ticket) {
        const result = await updateServiceTicketAction(ticket.id, payload);
        if (!result.success) {
          setError(result.message);
          return;
        }
        router.push(`/assistenza/${ticket.id}`);
        router.refresh();
        return;
      }

      const result = await saveServiceTicketAction(payload);
      if (!result.success) {
        setError(result.message);
        return;
      }
      if (result.ticketId) {
        router.push(`/assistenza/${result.ticketId}`);
      }
    });
  }

  const scheduledDefault = ticket?.scheduled_at ? ticket.scheduled_at.slice(0, 10) : "";

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div>
        <span className="mb-1 block text-sm font-medium text-slate-700">Azienda</span>
        <CompanySelect value={companyId} onChange={setCompanyId} disabled={isEdit} required />
      </div>

      <input
        type="hidden"
        name="order_id"
        defaultValue={ticket?.order_id ?? initialOrderId ?? ""}
      />

      {(ticket?.order_id || initialOrderId) && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Collegato all&apos;ordine:{" "}
          <Link
            href={`/ordini/${ticket?.order_id ?? initialOrderId}`}
            className="font-medium text-indigo-600 hover:underline"
          >
            apri ordine
          </Link>
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">Titolo</span>
          <input
            type="text"
            name="title"
            required
            defaultValue={ticket?.title ?? ""}
            placeholder="Es. Sostituzione motore tapparella"
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Numero ticket</span>
          <input
            type="text"
            name="number"
            defaultValue={ticket?.number ?? ""}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Categoria</span>
          <select
            name="category"
            defaultValue={ticket?.category ?? "assistenza"}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            {SERVICE_TICKET_CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Stato</span>
          <select
            name="status"
            defaultValue={ticket?.status ?? "aperto"}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            {SERVICE_TICKET_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Priorità</span>
          <select
            name="priority"
            defaultValue={ticket?.priority ?? "medium"}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            {SERVICE_TICKET_PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Prodotto (catalogo)</span>
          <select
            name="product_id"
            defaultValue={ticket?.product_id ?? ""}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            <option value="">Nessun prodotto collegato</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Intervento programmato</span>
          <input
            type="date"
            name="scheduled_at"
            defaultValue={scheduledDefault}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Descrizione</span>
        <textarea
          name="description"
          rows={3}
          defaultValue={ticket?.description ?? ""}
          className="w-full rounded-lg border border-slate-200 px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Risoluzione</span>
        <textarea
          name="resolution"
          rows={2}
          defaultValue={ticket?.resolution ?? ""}
          placeholder="Compila alla chiusura del ticket"
          className="w-full rounded-lg border border-slate-200 px-3 py-2"
        />
      </label>

      {error && <p className="text-sm text-rose-700">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isEdit ? "Salva ticket" : "Apri ticket"}
        </Button>
        <Link href={isEdit && ticket ? `/assistenza/${ticket.id}` : "/assistenza"}>
          <Button type="button" size="sm" variant="outline" disabled={isPending}>
            Annulla
          </Button>
        </Link>
      </div>
    </form>
  );
}
