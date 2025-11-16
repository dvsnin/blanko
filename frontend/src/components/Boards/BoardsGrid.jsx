import BoardCard from './BoardCard'
import styles from './Boards.module.css'

const mockBoards = [
  { id: 1, title: 'Q4 Planning', description: 'Strategic goals and initiatives', updatedAt: '2 hours ago', color: '#3b82f6', starred: true },
  { id: 2, title: 'Design System', description: 'Component library and guidelines', updatedAt: '1 day ago', color: '#8b5cf6', starred: false },
  { id: 3, title: 'Sprint 24', description: 'Current sprint tasks', updatedAt: '3 hours ago', color: '#ec4899', starred: true },
  { id: 4, title: 'User Research', description: 'Interview notes and insights', updatedAt: '4 days ago', color: '#f59e0b', starred: false },
  { id: 5, title: 'Product Roadmap', description: '2024 product timeline', updatedAt: '1 week ago', color: '#10b981', starred: false },
  { id: 6, title: 'Team Retro', description: 'Monthly retrospective', updatedAt: '5 days ago', color: '#06b6d4', starred: false },
  { id: 7, title: 'Marketing Campaign', description: 'Q1 2024 marketing plans', updatedAt: '2 days ago', color: '#f43f5e', starred: false },
  { id: 8, title: 'Bug Triage', description: 'Critical bugs and fixes', updatedAt: '6 hours ago', color: '#ef4444', starred: true },
]

function BoardsGrid() {
  return (
    <div className={styles.boardsSection}>
      <div className={styles.boardsHeader}>
        <h2 className={styles.boardsTitle}>Your Boards</h2>
        <div className={styles.boardsActions}>
          <button className={styles.filterButton}>
            <span>All boards</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button className={styles.createButton}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Create board
          </button>
        </div>
      </div>
      <div className={styles.boardsGrid}>
        {mockBoards.map(board => (
          <BoardCard key={board.id} {...board} />
        ))}
      </div>
    </div>
  )
}

export default BoardsGrid
