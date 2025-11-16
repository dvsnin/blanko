import styles from './Boards.module.css'

function BoardCard({ title, description, updatedAt, color, starred }) {
  return (
    <div className={styles.boardCard}>
      <div className={styles.cardHeader} style={{ backgroundColor: color }}>
        <div className={styles.cardColorBar}></div>
      </div>
      <div className={styles.cardBody}>
        <div className={styles.cardTitleRow}>
          <h3 className={styles.cardTitle}>{title}</h3>
          {starred && (
            <span className={styles.starIcon} aria-label="Starred">
              ⭐
            </span>
          )}
        </div>
        {description && (
          <p className={styles.cardDescription}>{description}</p>
        )}
        <div className={styles.cardFooter}>
          <span className={styles.cardTimestamp}>
            Updated {updatedAt}
          </span>
        </div>
      </div>
    </div>
  )
}

export default BoardCard
