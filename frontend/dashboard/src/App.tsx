import Topbar from "./components/Topbar";
import BoardsPage from "./pages/BoardsPage";
import TemplatesPage from "./pages/TemplatesPage";
import GroupsPage from "./pages/GroupsPage";
import ProfilePage from "./pages/ProfilePage";
import { useHashRoute } from "./hooks/useHashRoute";

/*
  App.tsx — shell: Topbar + the page for the current hash route.
  Teams/boards state lives in TeamsContext, user state in UserContext (main.tsx).
*/

export default function App() {
  const route = useHashRoute();
  return (
    <div className="app">
      <Topbar />
      {route.name === "boards" && <BoardsPage />}
      {route.name === "templates" && <TemplatesPage initialAge={route.age} />}
      {route.name === "groups" && <GroupsPage />}
      {route.name === "profile" && <ProfilePage />}
    </div>
  );
}
