/** «Анна Петрова» -> «Анна П.»: имя и инициал второго слова; одно слово как есть. */
export function shortName(full: string | undefined | null): string {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1].charAt(0).toUpperCase()}.`;
}
