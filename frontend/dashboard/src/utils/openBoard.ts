/** Переходы к доске и шаблону: в той же вкладке, как в Miro; Ctrl/Cmd/Shift и средняя кнопка - в новой. */

export const boardUrl = (board: { publicId: string }) => `/app/board/${encodeURIComponent(board.publicId)}`;
export const templateUrl = (template: { publicId: string }) => `/app/template/${encodeURIComponent(template.publicId)}`;

type ClickLike = { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; button?: number };

/** Точка навигации вынесена, чтобы тесты подменяли её, а не window.location. */
export const nav = {
  assign(url: string) { window.location.assign(url); },
};

export function wantsNewTab(ev?: ClickLike): boolean {
  return !!ev && (!!ev.metaKey || !!ev.ctrlKey || !!ev.shiftKey || ev.button === 1);
}

export function openInNewTab(url: string): void {
  const w = window.open(url, "_blank");
  if (!w) {
    alert("Пожалуйста, разрешите всплывающие окна для этого сайта.");
    return;
  }
  try { w.focus(); } catch {}
}

export function navigate(url: string, ev?: ClickLike): void {
  if (wantsNewTab(ev)) openInNewTab(url);
  else nav.assign(url);
}

export function openBoard(board: { publicId: string }, ev?: ClickLike): void {
  navigate(boardUrl(board), ev);
}

export function openTemplate(template: { publicId: string }, ev?: ClickLike): void {
  navigate(templateUrl(template), ev);
}
