import "./BoardCover.css";
import { colorForId, initialsOf } from "../utils/cover";
import { coverForBoard } from "../utils/templates";

export interface BoardCoverProps {
  board: { id: string; title: string; owner: string; ownerId?: string; templateId?: string; colorKey?: string };
  size: "card" | "small";
}

export default function BoardCover({ board, size }: BoardCoverProps) {
  const cover = coverForBoard(board);
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
      {size === "card" && (
        <span
          className={`board-cover__author cover--${colorForId(board.ownerId ?? board.owner)}`}
          title={board.owner}
        >
          {initialsOf(board.owner)}
        </span>
      )}
    </div>
  );
}
