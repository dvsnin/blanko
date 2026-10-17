export function formatLastOpened(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  } catch {
    return "";
  }
}

const pad2 = (n: number) => String(n).padStart(2, "0");

export function formatRelative(iso: string | undefined, now: Date = new Date()): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  if (now.getTime() - date.getTime() < 60_000) return "только что";

  const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((midnight(now) - midnight(date)) / 86_400_000);

  if (days <= 0) return `сегодня, ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  if (days === 1) return "вчера";
  if (days <= 4) return `${days} дня назад`;
  if (days <= 6) return `${days} дней назад`;
  if (days <= 13) return "неделю назад";
  if (days <= 29) return `${Math.floor(days / 7)} недели назад`;
  return formatLastOpened(iso);
}
