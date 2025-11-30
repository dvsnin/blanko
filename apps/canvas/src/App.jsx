import React from "react";

export default function App({ uid }) {
    return (
        <div className="canvas-app">
            <header>
                <h1>Canvas board</h1>
                <p>UID: {uid || "unknown"}</p>
            </header>
            <main>
                {/* ваш canvas UI тут */}
            </main>
        </div>
    );
}