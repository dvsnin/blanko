import { useEffect, useState } from "react";
import "./BoardCover.css";
import { coverForBoard } from "../utils/templates";
import type { Template } from "../types";

export interface BoardCoverProps {
  board: { id: string; title: string; owner: string; ownerId?: string; templateId?: string; colorKey?: string };
  size: "card" | "small";
  template?: Template;
  /** Снимок содержимого; до загрузки и при ошибке видна цветная плитка. */
  previewUrl?: string;
}

export default function BoardCover({ board, size, template, previewUrl }: BoardCoverProps) {
  const cover = coverForBoard(board, template);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setLoaded(false); setFailed(false); }, [previewUrl]);
  return (
    <div
      className={`board-cover board-cover--${size} cover--${cover.colorKey}`}
      aria-hidden="true"
    >
      <span
        className={`board-cover__shape board-cover__shape--${cover.shape} board-cover__shape--corner-${cover.corner}`}
      />
      {previewUrl && !failed && (
        <img
          className={`board-cover__preview${loaded ? " is-loaded" : ""}`}
          src={previewUrl}
          alt=""
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
