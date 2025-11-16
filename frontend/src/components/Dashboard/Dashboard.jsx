import Topbar from '../Topbar/Topbar'
import TemplatesIsland from '../TemplatesIsland/TemplatesIsland'
import BoardsGrid from '../Boards/BoardsGrid'
import './Dashboard.css'

function Dashboard() {
  return (
    <div className="dashboard">
      <Topbar />
      <main className="dashboard-main">
        <TemplatesIsland />
        <BoardsGrid />
      </main>
    </div>
  )
}

export default Dashboard
