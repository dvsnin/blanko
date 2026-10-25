import { useEffect } from "react";
import Topbar from "./components/Topbar";
import BoardsPage from "./pages/BoardsPage";
import TemplatesPage from "./pages/TemplatesPage";
import GroupsPage from "./pages/GroupsPage";
import ProfilePage from "./pages/ProfilePage";
import PeoplePage from "./pages/PeoplePage";
import { useHashRoute } from "./hooks/useHashRoute";
import { useUser } from "./contexts/UserContext";
import { pageTitle } from "./utils/pageTitle";

export default function App() {
  const route = useHashRoute();
  const { workspaceName } = useUser();
  useEffect(() => { window.scrollTo(0, 0); }, [route.name, route.name === "templates" ? route.age : undefined]);
  // Вкладка браузера: раздел и название сада; сервер отдаёт тот же заголовок для «Досок» до загрузки.
  useEffect(() => { document.title = pageTitle(route, workspaceName); }, [route, workspaceName]);
  return (
    <div className="app">
      <Topbar />
      {route.name === "boards" && <BoardsPage />}
      {route.name === "templates" && <TemplatesPage key={route.age ?? "all"} initialAge={route.age} />}
      {route.name === "groups" && <GroupsPage />}
      {route.name === "profile" && <ProfilePage />}
      {route.name === "people" && <PeoplePage />}
    </div>
  );
}
