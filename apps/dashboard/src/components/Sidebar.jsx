import React from "react";
import "./Sidebar.css";
import { FiHome, FiClock, FiStar } from "react-icons/fi";

export default function Sidebar() {
    return (
        <aside className="sidebar" aria-label="Main navigation">
            <nav className="sidebar-nav" role="navigation" aria-label="Main">
                <button className="sidebar-item sidebar-item--active" aria-current="page">
                    <FiHome className="sidebar-icon" aria-hidden />
                    <span>Home</span>
                </button>

                <button className="sidebar-item">
                    <FiClock className="sidebar-icon" aria-hidden />
                    <span>Recent</span>
                </button>

                <button className="sidebar-item">
                    <FiStar className="sidebar-icon" aria-hidden />
                    <span>Starred</span>
                </button>
            </nav>
        </aside>
    );
}