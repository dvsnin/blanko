import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./app.css";

const uid = window.APP_UID || null;

createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <App uid={uid} />
    </React.StrictMode>
);