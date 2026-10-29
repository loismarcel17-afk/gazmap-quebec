import messages from "@/i18n/fr-CA.json";

/**
 * All UI text. Typed from the JSON itself, so `t.map.sourse` is a compile error.
 * Usage: t.fuel.regular, or interpolate(t.map.updatedAt, { date })
 */
export const t = messages;

/** Replaces {name} placeholders: interpolate("Prix du {date}", { date: "28 oct." }) */
export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
    key in values ? String(values[key]) : placeholder,
  );
}

export interface PluralForms {
  one: string;
  other: string;
}

// Knows each language's rules: in French 0 and 1 are singular ("0 station"),
// unlike English ("0 stations").
const pluralRules = new Intl.PluralRules("fr-CA");

/** Picks the singular or plural text for `count`, then fills {count} and the other placeholders. */
export function plural(
  forms: PluralForms,
  count: number,
  values: Record<string, string | number> = {},
): string {
  const template = pluralRules.select(count) === "one" ? forms.one : forms.other;
  return interpolate(template, { count, ...values });
}
