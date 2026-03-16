import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { UserProvider } from "./contexts/UserContext";
import { TeamsProvider } from "./contexts/TeamsContext";
import "./app.css";

const currentUser =
  (window.dashData && window.dashData.login) || "dvsnin";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <UserProvider>
      <TeamsProvider currentUser={currentUser}>
        <App />
      </TeamsProvider>
    </UserProvider>
  </React.StrictMode>,
);
