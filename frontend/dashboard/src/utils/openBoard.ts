export function openBoardWindow(board: { publicId: string }): void {
  openWindow(`/app/board/${encodeURIComponent(board.publicId)}`);
}

export function openTemplateWindow(template: { publicId: string }): void {
  openWindow(`/app/template/${encodeURIComponent(template.publicId)}`);
}

function openWindow(url: string): void {
  const w = window.open(url, "_blank");
  if (!w) {
    alert("Пожалуйста, разрешите всплывающие окна для этого сайта.");
    return;
  }
  try { w.focus(); } catch {}
}
