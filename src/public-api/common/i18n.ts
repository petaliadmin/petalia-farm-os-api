import {
  DEFAULT_LOCALE,
  Locale,
  SUPPORTED_LOCALES,
} from "../public-api.constants";

/**
 * Picks the best supported locale from an Accept-Language header
 * ("wo-SN,fr;q=0.8,en;q=0.5" → "wo"). Falls back to French.
 */
export function resolveLocale(header: string | undefined | null): Locale {
  if (!header) return DEFAULT_LOCALE;
  const candidates = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return {
        lang: tag.toLowerCase().split("-")[0],
        q: q ? Number(q.slice(2)) : 1,
      };
    })
    .filter((c) => c.lang && !Number.isNaN(c.q) && c.q > 0)
    .sort((a, b) => b.q - a.q);

  for (const c of candidates) {
    if ((SUPPORTED_LOCALES as readonly string[]).includes(c.lang)) {
      return c.lang as Locale;
    }
  }
  return DEFAULT_LOCALE;
}

export type Translations = Record<Locale, string>;

export function interpolate(
  template: string,
  params: Record<string, unknown> = {},
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    params[key] === undefined ? `{${key}}` : String(params[key]),
  );
}

export function translate(
  messages: Translations,
  locale: Locale,
  params?: Record<string, unknown>,
): string {
  return interpolate(messages[locale] ?? messages[DEFAULT_LOCALE], params);
}
