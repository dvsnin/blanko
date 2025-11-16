import { useState } from 'react';
import Topbar from '../Topbar/Topbar';
import TemplatesIsland from '../TemplatesIsland/TemplatesIsland';
import BoardsGrid from '../Boards/BoardsGrid';
import './Dashboard.css';

// Mock data for templates
const MOCK_TEMPLATES = [
  {
    id: 1,
    name: 'Blank',
    description: 'Start from scratch',
    thumbnail: null,
    isBlank: true
  },
  {
    id: 2,
    name: 'Kanban',
    description: 'Task management board',
    thumbnail: null,
    color: '#3b82f6'
  },
  {
    id: 3,
    name: 'Sprint Planning',
    description: 'Agile sprint board',
    thumbnail: null,
    color: '#8b5cf6'
  },
  {
    id: 4,
    name: 'Product Roadmap',
    description: 'Plan your product',
    thumbnail: null,
    color: '#ec4899'
  },
  {
    id: 5,
    name: 'Weekly Tasks',
    description: 'Organize your week',
    thumbnail: null,
    color: '#10b981'
  }
];

// Mock data for boards
const MOCK_BOARDS = [
  {
    id: 1,
    name: 'Q4 Planning',
    updatedAt: new Date('2024-01-15'),
    color: '#3b82f6'
  },
  {
    id: 2,
    name: 'Team Sprint',
    updatedAt: new Date('2024-01-14'),
    color: '#8b5cf6'
  },
  {
    id: 3,
    name: 'Design System',
    updatedAt: new Date('2024-01-13'),
    color: '#ec4899'
  },
  {
    id: 4,
    name: 'Marketing Campaign',
    updatedAt: new Date('2024-01-12'),
    color: '#10b981'
  },
  {
    id: 5,
    name: 'Product Launch',
    updatedAt: new Date('2024-01-10'),
    color: '#f59e0b'
  },
  {
    id: 6,
    name: 'Customer Feedback',
    updatedAt: new Date('2024-01-09'),
    color: '#06b6d4'
  }
];

function Dashboard() {
  const [showTemplates, setShowTemplates] = useState(false);

  const handleNewBoard = () => {
    setShowTemplates(true);
  };

  const handleTemplateSelect = (template) => {
    console.log('Selected template:', template);
    // In a real app, this would create a new board from the template
    setShowTemplates(false);
  };

  const handleTemplateClose = () => {
    setShowTemplates(false);
  };

  return (
    <div className="dashboard">
      <Topbar onNewBoard={handleNewBoard} />
      
      <main className="dashboard-main">
        <div className="dashboard-content">
          <div className="dashboard-header">
            <h1 className="dashboard-title">Your Boards</h1>
            <p className="dashboard-subtitle">
              {MOCK_BOARDS.length} {MOCK_BOARDS.length === 1 ? 'board' : 'boards'}
            </p>
          </div>

          <BoardsGrid boards={MOCK_BOARDS} />
        </div>
      </main>

      {showTemplates && (
        <TemplatesIsland
          templates={MOCK_TEMPLATES}
          onSelect={handleTemplateSelect}
          onClose={handleTemplateClose}
        />
      )}
    </div>
  );
}

export default Dashboard;
