import BoardCard from './BoardCard';
import styles from './Boards.module.css';

function BoardsGrid({ boards }) {
  return (
    <div className={styles.boardsGrid}>
      {boards.map((board) => (
        <BoardCard key={board.id} board={board} />
      ))}
    </div>
  );
}

export default BoardsGrid;
