import "./BoardCover.css";
import { coverFor, colorForId, initialsOf } from "../utils/cover";

export interface BoardCoverProps {
  board: { id: string; title: string; owner: string; ownerId?: string };
  size: "card" | "small";
  topic?: string; // reserved for phase 2, not rendered yet
}

export default function BoardCover({ board, size }: BoardCoverProps) {
  const cover = coverFor(board);
  return (
    <div
      className={`board-cover board-cover--${size} cover--${cover.colorKey}`}
      aria-hidden="true"
    >
      <span
        className={`board-cover__shape board-cover__shape--${cover.shape} board-cover__shape--corner-${cover.corner}`}
      />
      <span className="board-cover__glyph">{cover.glyph}</span>
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
