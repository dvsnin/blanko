import StarButton from "./StarButton";

/*
  StarToggle - общая звезда «в избранное» для любых сущностей (доски, группы, …).
  Подписи и тосты нейтральные, без названия сущности, чтобы переиспользовать как есть.
*/

export const STAR_LABEL = {
  add: "Добавить в избранное",
  remove: "Убрать из избранного",
} as const;

export const STAR_MESSAGE = {
  added: "Добавлено в избранное",
  removed: "Убрано из избранного",
} as const;

/** Текст тоста по результату переключения. */
export function starMessage(willStar: boolean): string {
  return willStar ? STAR_MESSAGE.added : STAR_MESSAGE.removed;
}

export interface StarToggleProps {
  isStarred: boolean;
  /** Переключает состояние у источника данных (контекст, API). */
  onToggle: () => void | Promise<unknown>;
  /** Показ тоста; если не передан - тихо. */
  notify?: (message: string) => void;
  variant?: "grid" | "list";
  size?: number;
}

export default function StarToggle({ isStarred, onToggle, notify, variant = "grid", size = 36 }: StarToggleProps) {
  const handleToggle = () => {
    const willStar = !isStarred;
    void onToggle();
    notify?.(starMessage(willStar));
  };

  return (
    <StarButton
      isStarred={isStarred}
      onToggle={handleToggle}
      variant={variant}
      size={size}
      ariaLabel={isStarred ? STAR_LABEL.remove : STAR_LABEL.add}
    />
  );
}
