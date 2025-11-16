import { useFitCount } from '../../hooks/useFitCount';
import TemplateThumb from './TemplateThumb';
import './TemplatesIsland.css';

function TemplatesIsland({ templates, onSelect, onClose }) {
  const { containerRef, fitCount } = useFitCount(180, 16, 2);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="templates-island-backdrop" onClick={handleBackdropClick}>
      <div className="templates-island">
        <div className="templates-island-header">
          <div>
            <h2 className="templates-island-title">Choose a Template</h2>
            <p className="templates-island-subtitle">
              Start with a template or create a blank board
            </p>
          </div>
          <button
            className="templates-island-close"
            onClick={onClose}
            aria-label="Close"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M18 6L6 18M6 6L18 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div className="templates-island-grid" ref={containerRef}>
          {templates.slice(0, fitCount).map((template) => (
            <TemplateThumb
              key={template.id}
              template={template}
              onClick={() => onSelect(template)}
            />
          ))}
        </div>

        {templates.length > fitCount && (
          <div className="templates-island-footer">
            <button className="templates-island-more">
              View all {templates.length} templates →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default TemplatesIsland;
