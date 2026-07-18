import type { ManualMeta } from "../types";

interface ManualeFooterProps {
  meta: ManualMeta;
}

export function ManualeFooter({ meta }: ManualeFooterProps) {
  return (
    <footer className="mt-8 border-t border-slate-200 pt-6 text-center text-xs text-slate-500">
      <p>
        Versione manuale: {meta.manualVersion} · Versione CRM: {meta.crmVersion} · Ultimo
        aggiornamento: {meta.lastUpdated}
      </p>
      <p className="mt-1">Eterya Srl – Documento operativo interno</p>
    </footer>
  );
}
