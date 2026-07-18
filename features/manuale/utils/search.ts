import { MANUAL_ADMIN_TOPICS } from "../content/admin-section";
import { MANUAL_CHANGELOG } from "../content/changelog";
import { MANUAL_CHECKLISTS } from "../content/checklists";
import { MANUAL_FAQ } from "../content/faq";
import { MANUAL_SECTIONS } from "../content/sections";
import type { ManualIndexItem, ManualSearchResult } from "../types";

export function normalizeText(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

function excerpt(text: string, maxLength = 120): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trim()}…`;
}

export function buildIndexItems(isAdmin: boolean): ManualIndexItem[] {
  const items: ManualIndexItem[] = [
    { id: "checklist-operative", title: "Checklist operative", kind: "checklists" },
    ...MANUAL_SECTIONS.map((section) => ({
      id: section.id,
      title: section.title,
      kind: "section" as const,
    })),
    { id: "domande-frequenti", title: "Domande frequenti", kind: "faq" },
    { id: "cronologia-aggiornamenti", title: "Cronologia aggiornamenti", kind: "changelog" },
  ];

  if (isAdmin) {
    items.push({
      id: "manuale-amministratore",
      title: "Manuale Amministratore",
      kind: "admin",
    });
  }

  return items;
}

export function searchManual(query: string, isAdmin: boolean): ManualSearchResult[] {
  const normalizedQuery = normalizeText(query.trim());
  if (!normalizedQuery) return [];

  const results: ManualSearchResult[] = [];

  for (const group of MANUAL_CHECKLISTS) {
    const haystack = [group.title, ...group.items].join(" ");
    if (normalizeText(haystack).includes(normalizedQuery)) {
      results.push({
        id: "checklist-operative",
        title: group.title,
        excerpt: excerpt(group.items.find((item) => normalizeText(item).includes(normalizedQuery)) ?? group.items[0] ?? group.title),
        kind: "checklists",
      });
    }
  }

  for (const section of MANUAL_SECTIONS) {
    const haystack = [
      section.title,
      section.purpose,
      ...(section.steps ?? []),
      ...(section.tips ?? []),
      ...(section.errors?.flatMap((e) => [e.problem, e.solution]) ?? []),
    ].join(" ");

    if (normalizeText(haystack).includes(normalizedQuery)) {
      const matchLine =
        section.steps?.find((step) => normalizeText(step).includes(normalizedQuery)) ??
        section.purpose;
      results.push({
        id: section.id,
        title: section.title,
        excerpt: excerpt(matchLine),
        kind: "section",
      });
    }
  }

  for (const item of MANUAL_FAQ) {
    const haystack = [item.question, item.answer].join(" ");
    if (normalizeText(haystack).includes(normalizedQuery)) {
      results.push({
        id: "domande-frequenti",
        title: item.question,
        excerpt: excerpt(item.answer),
        kind: "faq",
      });
    }
  }

  for (const entry of MANUAL_CHANGELOG) {
    const haystack = [entry.version, entry.title, entry.date, ...entry.highlights].join(" ");
    if (normalizeText(haystack).includes(normalizedQuery)) {
      results.push({
        id: "cronologia-aggiornamenti",
        title: `Versione ${entry.version} — ${entry.title}`,
        excerpt: excerpt(entry.highlights[0] ?? entry.title),
        kind: "changelog",
      });
    }
  }

  if (isAdmin) {
    for (const topic of MANUAL_ADMIN_TOPICS) {
      const haystack = [topic.title, topic.description, ...topic.steps].join(" ");
      if (normalizeText(haystack).includes(normalizedQuery)) {
        results.push({
          id: "manuale-amministratore",
          title: topic.title,
          excerpt: excerpt(topic.description),
          kind: "admin",
        });
      }
    }
  }

  const seen = new Set<string>();
  return results.filter((result) => {
    const key = `${result.kind}:${result.id}:${result.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
