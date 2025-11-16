import "./app.css";
import Sidebar from "./components/Sidebar";
import Boards from "./components/Boards";

export default function App() {
    return (
        <div className="app-layout">
            <Sidebar />
            <div className="content">
                <Boards />
            </div>
        </div>
    );
}
