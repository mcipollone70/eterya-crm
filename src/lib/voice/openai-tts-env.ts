import "server-only";

const OPENAI_API_KEY_ENV = "OPENAI_API_KEY";

/** `true` se OPENAI_API_KEY è configurata lato server. Mai esporre al client. */
export function isOpenAiTtsConfigured(): boolean {
  const key = process.env[OPENAI_API_KEY_ENV];
  return typeof key === "string" && key.trim().length > 0;
}

/** Restituisce la chiave OpenAI o `null`. Solo uso server-side. */
export function getOpenAiApiKey(): string | null {
  const key = process.env[OPENAI_API_KEY_ENV];
  if (!key || !key.trim()) {
    return null;
  }
  return key.trim();
}
