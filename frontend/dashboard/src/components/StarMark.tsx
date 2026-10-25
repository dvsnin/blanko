import "./StarButton.css";

/* Метка «в избранном» на карточке до наведения: тот же глиф и размер, что у StarButton,
   чтобы при наведении звезда не менялась, а рядом просто появлялось «⋯». Не кликабельна. */
export default function StarMark() {
    return (
        <span className="card-star-mark" aria-hidden="true">
            <span className="star-glyph">★</span>
        </span>
    );
}
