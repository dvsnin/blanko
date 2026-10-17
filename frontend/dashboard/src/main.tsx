import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { UserProvider } from "./contexts/UserContext";
import { TeamsProvider } from "./contexts/TeamsContext";
import { TemplatesProvider } from "./contexts/TemplatesContext";
import "./app.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <UserProvider>
      <TeamsProvider>
        <TemplatesProvider>
          <App />
        </TemplatesProvider>
      </TeamsProvider>
    </UserProvider>
  </React.StrictMode>,
);
