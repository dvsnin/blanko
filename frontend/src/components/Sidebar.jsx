import React from "react";
import "./Sidebar.css";
import { FiHome, FiClock, FiStar } from "react-icons/fi";

export default function Sidebar() {
    return (
        <aside className="sidebar">
            <nav className="sidebar-nav">

                <button className="sidebar-item sidebar-item--active">
                    <FiHome className="sidebar-icon" />
                    <span>Home</span>
                </button>

                <button className="sidebar-item">
                    <FiClock className="sidebar-icon" />
                    <span>Recent</span>
                </button>

                <button className="sidebar-item">
                    <FiStar className="sidebar-icon" />
                    <span>Starred</span>
                </button>

            </nav>
        </aside>
    );
}
