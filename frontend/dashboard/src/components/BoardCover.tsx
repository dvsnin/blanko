import "./BoardCover.css";
import { coverForBoard } from "../utils/templates";
import type { Template } from "../types";

export interface BoardCoverProps {
  board: { id: string; title: string; owner: string; ownerId?: string; templateId?: string; colorKey?: string };
  size: "card" | "small";
  template?: Template;
}

export default function BoardCover({ board, size, template }: BoardCoverProps) {
  const cover = coverForBoard(board, template);
  return (
    <div
      className={`board-cover board-cover--${size} cover--${cover.colorKey}`}
      aria-hidden="true"
    >
      <span
        className={`board-cover__shape board-cover__shape--${cover.shape} board-cover__shape--corner-${cover.corner}`}
      />
      <span className="board-cover__glyph">{cover.glyph}</span>
      {size === "card" && cover.topic && (
        <span className="board-cover__topic" style={{ color: cover.topic.color }}>
          {cover.topic.label}
        </span>
      )}
    </div>
  );
}
