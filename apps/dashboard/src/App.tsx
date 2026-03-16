import TeamsPanel from "./components/TeamsPanel";
import Boards from "./components/Boards";

/*
  App.tsx — layout shell.
  All teams/boards state lives in TeamsContext (provided in main.tsx).
  All user state lives in UserContext (provided in main.tsx).
*/

export default function App() {
  return (
    <div className="app-layout">
      <TeamsPanel />
      <div className="content">
        <Boards />
      </div>
    </div>
  );
}
