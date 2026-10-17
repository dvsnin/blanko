export function openBoardWindow(board: { publicId: string }): void {
  const url = `/app/board/${encodeURIComponent(board.publicId)}`;
  const w = window.open(url, "_blank");
  if (!w) {
    alert("Пожалуйста, разрешите всплывающие окна для этого сайта.");
    return;
  }
  try { w.focus(); } catch {}
}
