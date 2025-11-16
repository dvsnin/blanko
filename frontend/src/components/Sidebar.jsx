import React from "react";
import "./Sidebar.css";

export default function Sidebar() {
    return (
        <aside className="sidebar">
            <nav className="sidebar-nav" role="navigation" aria-label="Main navigation">

                <button className="sidebar-item sidebar-item--active" aria-label="Home" aria-current="page">
                    <span className="sidebar-icon">⌂</span>
                    <span>Home</span>
                </button>

                <button className="sidebar-item" aria-label="Recent">
                    <span className="sidebar-icon">⏱</span>
                    <span>Recent</span>
                </button>

                <button className="sidebar-item" aria-label="Starred">
                    <span className="sidebar-icon">☆</span>
                    <span>Starred</span>
                </button>

            </nav>
        </aside>
    );
}
