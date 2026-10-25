import { useState } from "react";
import type { Board } from "../types";

/* PresentSection - раздел «Показ на экране» в диалоге доступа доски: включить на срок,
   показать ссылку для проектора или телевизора, выключить. */

const HOURS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 1, label: "1 час" },
  { value: 12, label: "12 часов" },
  { value: 24, label: "24 часа" },
  { value: 0, label: "Пока не выключу" },
];

function expiresText(iso?: string): string {
  if (!iso) return "Действует, пока вы не выключите показ";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? `Действует до ${time}` : `Действует до ${time}, ${d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`;
}

interface Props {
  board: Board;
  onSetPresent: (hours: number | null) => void;
  onNotify: (message: string) => void;
}

export default function PresentSection({ board, onSetPresent, onNotify }: Props) {
  const [hours, setHours] = useState(12);
  const link = board.presentToken ? `${window.location.origin}/app/present/${board.presentToken}` : "";

  const copy = () => {
    navigator.clipboard?.writeText(link)
      .then(() => onNotify("Ссылка показа скопирована"))
      .catch(() => onNotify("Не удалось скопировать"));
  };

  if (!board.presentEnabled) {
    return (
      <div className="ts-section present">
        <label className="field-label ts-section-label" htmlFor="present-hours">Показ на экране</label>
        <p className="ts-section-text">Доска откроется на проекторе или телевизоре без входа и сама будет следовать за вами. Зрители только смотрят.</p>
        <div className="present__row">
          <select id="present-hours" className="boards-modal-input" value={hours} aria-label="Срок показа" onChange={(e) => setHours(Number(e.target.value))}>
            {HOURS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
          </select>
          <button type="button" className="btn btn--soft" onClick={() => onSetPresent(hours)}>Включить показ</button>
        </div>
      </div>
    );
  }

  return (
    <div className="ts-section present">
      <label className="field-label ts-section-label" htmlFor="present-link">Показ на экране</label>
      <div className="present__main">
        <div className="present__row">
          <input id="present-link" className="boards-modal-input" value={link} readOnly aria-label="Ссылка показа" onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="btn btn--ghost" onClick={copy}>Копировать</button>
        </div>
        <p className="ts-section-text">Откройте ссылку на проекторе или телевизоре: экран будет следовать за ведущим, зрители только смотрят.</p>
        <p className="ts-section-text">
          {board.presenterName ? `Ведущий: ${board.presenterName}. ` : ""}{expiresText(board.presentExpiresAt)}. Другой воспитатель может забрать роль ведущего кнопкой «Вести показ» на доске.
        </p>
        <button type="button" className="btn btn--danger-ghost" onClick={() => onSetPresent(null)}>Выключить показ</button>
      </div>
    </div>
  );
}
