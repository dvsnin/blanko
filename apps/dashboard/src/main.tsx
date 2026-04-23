import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { UserProvider } from "./contexts/UserContext";
import { TeamsProvider } from "./contexts/TeamsContext";
import "./app.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <UserProvider>
      <TeamsProvider>
        <App />
      </TeamsProvider>
    </UserProvider>
  </React.StrictMode>,
);
