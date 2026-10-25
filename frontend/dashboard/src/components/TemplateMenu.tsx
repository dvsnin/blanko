import { useMemo, useRef } from "react";
import "./TemplateCard.css";
import MenuButton from "./MenuButton";
import { useClickOutside } from "../hooks/useClickOutside";
import { useEscapeKey } from "../hooks/useEscapeKey";
import type { Template } from "../types";

/* «⋯» на карточке шаблона: «Настройки шаблона» и «Удалить шаблон» только при canEdit, как в меню группы. */

export interface TemplateMenuProps {
  template: Template;
  /** Состояние держит карточка: закрывает меню при уходе курсора. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenNewTab: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function TemplateMenu({ template, open, onOpenChange, onOpenNewTab, onDuplicate, onEdit, onDelete }: TemplateMenuProps) {
  const setOpen = onOpenChange;
  const wrapRef = useRef<HTMLDivElement>(null);
  const refs = useMemo(() => [wrapRef], []);
  const close = () => setOpen(false);
  useClickOutside(refs, close, open);
  useEscapeKey(close, open);

  function run(fn: () => void) {
    setOpen(false);
    fn();
  }

  return (
    <div className="tpl-menu" ref={wrapRef}>
      <MenuButton
        ariaLabel="Действия с шаблоном"
        ariaHasPopup="menu"
        ariaExpanded={open}
        variant="list"
        size={36}
        onClick={() => setOpen(!open)}
      />
      {open && (
        <div className="tpl-menu__popover" role="menu">
          <button type="button" role="menuitem" className="tpl-menu__item" onClick={() => run(onOpenNewTab)}>
            Открыть в новой вкладке
          </button>
          <button type="button" role="menuitem" className="tpl-menu__item" onClick={() => run(onDuplicate)}>
            Дублировать
          </button>
          {template.canEdit && (
            <>
              <span className="tpl-menu__sep" aria-hidden />
              <button type="button" role="menuitem" className="tpl-menu__item" onClick={() => run(onEdit)}>
                Настройки шаблона
              </button>
              <button type="button" role="menuitem" className="tpl-menu__item tpl-menu__item--danger" onClick={() => run(onDelete)}>
                Удалить шаблон
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
