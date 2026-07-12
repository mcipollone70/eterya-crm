export function formatCurrency(value: number, currency = "EUR"): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function formatTime(time: string): string {
  return time;
}

export function formatRelativeDate(date: string): string {
  const now = new Date();
  const target = new Date(date);
  const diffDays = Math.floor(
    (target.getTime() - now.setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "Oggi";
  if (diffDays === 1) return "Domani";
  if (diffDays === -1) return "Ieri";
  return formatDate(date);
}
