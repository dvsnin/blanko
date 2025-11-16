import './TemplateThumb.css';

function TemplateThumb({ template, onClick }) {
  const { name, description, isBlank, color } = template;

  return (
    <button className="template-thumb" onClick={onClick}>
      <div
        className={`template-thumb-preview ${isBlank ? 'is-blank' : ''}`}
        style={color ? { backgroundColor: color } : {}}
      >
        {isBlank ? (
          <svg
            width="32"
            height="32"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M16 8V24M8 16H24"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <div className="template-thumb-icon">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" fill="white" opacity="0.3" />
              <rect x="3" y="14" width="7" height="7" rx="1" fill="white" opacity="0.5" />
              <rect x="14" y="3" width="7" height="7" rx="1" fill="white" opacity="0.7" />
              <rect x="14" y="14" width="7" height="7" rx="1" fill="white" opacity="0.9" />
            </svg>
          </div>
        )}
      </div>

      <div className="template-thumb-info">
        <h3 className="template-thumb-name">{name}</h3>
        <p className="template-thumb-description">{description}</p>
      </div>
    </button>
  );
}

export default TemplateThumb;
