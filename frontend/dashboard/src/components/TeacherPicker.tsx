import { useEffect, useMemo, useState } from "react";
import { api, type AccountSearchDTO } from "../api/client";
import { shortName } from "../utils/shortName";

/**
 * Воспитатели группы: выбор из зарегистрированных педагогов, как при добавлении участников,
 * но без приглашений. В БД по-прежнему текст «Имя Фамилия, ...», поэтому здесь только имена:
 * старые записи, набранные руками, остаются чипами и так же снимаются крестиком.
 */
interface TeacherPickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const splitTeachers = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

export default function TeacherPicker({ value, onChange, disabled = false }: TeacherPickerProps) {
  const [directory, setDirectory] = useState<AccountSearchDTO[]>([]);
  const [query, setQuery] = useState("");
  const selected = useMemo(() => splitTeachers(value), [value]);

  useEffect(() => {
    if (disabled) return;
    let alive = true;
    api.accounts.search("").then((list) => { if (alive) setDirectory(list); }).catch(() => {});
    return () => { alive = false; };
  }, [disabled]);

  const needle = query.trim().toLowerCase();
  const options = directory.filter((a) =>
    a.name.trim() !== "" && !selected.includes(a.name.trim())
    && (!needle || a.name.toLowerCase().includes(needle) || a.email.toLowerCase().includes(needle)));

  const add = (name: string) => { onChange([...selected, name.trim()].join(", ")); setQuery(""); };
  const remove = (name: string) => onChange(selected.filter((x) => x !== name).join(", "));

  return (
    <div className="teachers">
      {selected.length > 0 ? (
        <ul className="teachers__chips" aria-label="Воспитатели">
          {selected.map((name) => (
            <li key={name} className="chip teachers__chip">
              {name}
              {!disabled && (
                <button type="button" className="teachers__remove" aria-label={`Убрать: ${name}`} onClick={() => remove(name)}>×</button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="ts-section-text">{disabled ? "Не указаны" : "Пока никого: выберите из списка"}</p>
      )}
      {!disabled && (
        <>
          <input
            className="boards-modal-input"
            type="search"
            value={query}
            placeholder="Имя или почта"
            aria-label="Найти воспитателя"
            onChange={(e) => setQuery(e.target.value)}
          />
          {options.length > 0 ? (
            <ul className="ts-members__candidates" aria-label="Педагоги сада">
              {options.map((a) => (
                <li key={a.id}>
                  <button type="button" className="ts-members__candidate teachers__option" aria-label={`Добавить: ${a.name}`} onClick={() => add(a.name)}>
                    <span className="ts-members__avatar ts-members__avatar--small" aria-hidden="true">{a.name.trim().charAt(0).toUpperCase()}</span>
                    <span className="ts-members__who">
                      <span className="ts-members__name">{shortName(a.name)}</span>
                      <span className="ts-members__email">{a.email}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ts-section-text" style={{ marginTop: 6 }}>{needle ? "Никого не нашли" : "Все зарегистрированные педагоги уже в списке"}</p>
          )}
        </>
      )}
    </div>
  );
}
