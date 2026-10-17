/** item после afterId, иначе в конец. */
export function insertAfter<T extends { id: string }>(list: T[], afterId: string, item: T): T[] {
  const i = list.findIndex((x) => x.id === afterId);
  if (i < 0) return [...list, item];
  return [...list.slice(0, i + 1), item, ...list.slice(i + 1)];
}
