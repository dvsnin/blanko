import React from "react";
import "./Sidebar.css";

export default function Sidebar() {
    return (
        <aside className="sidebar">
            <nav className="sidebar-nav">

                <button className="sidebar-item sidebar-item--active">
                    <span className="sidebar-icon">⌂</span>
                    <span>Home</span>
                </button>

                <button className="sidebar-item">
                    <span className="sidebar-icon">⏱</span>
                    <span>Recent</span>
                </button>

                <button className="sidebar-item">
                    <span className="sidebar-icon">☆</span>
                    <span>Starred</span>
                </button>

            </nav>
        </aside>
    );
}
