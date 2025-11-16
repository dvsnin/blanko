import { useFitCount } from '../../hooks/useFitCount'
import TemplateThumb from './TemplateThumb'
import './TemplatesIsland.css'

const templates = [
  { id: 1, name: 'Blank Board', description: 'Start from scratch', color: '#3b82f6', icon: '📝' },
  { id: 2, name: 'Kanban', description: 'Task management', color: '#8b5cf6', icon: '📋' },
  { id: 3, name: 'Sprint Planning', description: 'Agile workflow', color: '#ec4899', icon: '🚀' },
  { id: 4, name: 'Brainstorm', description: 'Mind mapping', color: '#f59e0b', icon: '💡' },
  { id: 5, name: 'Retrospective', description: 'Team reflection', color: '#10b981', icon: '🔄' },
  { id: 6, name: 'Roadmap', description: 'Product planning', color: '#06b6d4', icon: '🗺️' },
]

function TemplatesIsland() {
  const { containerRef, fitCount } = useFitCount(240, 12, 1)

  const visibleTemplates = templates.slice(0, fitCount)
  const hasMore = templates.length > fitCount

  return (
    <div className="templates-island">
      <div className="templates-header">
        <h2 className="templates-title">Start with a template</h2>
        <button className="templates-view-all">
          View all templates →
        </button>
      </div>
      <div className="templates-grid" ref={containerRef}>
        {visibleTemplates.map(template => (
          <TemplateThumb key={template.id} {...template} />
        ))}
        {hasMore && (
          <div className="template-more">
            <div className="template-more-count">
              +{templates.length - fitCount} more
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TemplatesIsland
