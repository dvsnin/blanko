import './TemplateThumb.css'

function TemplateThumb({ name, description, color, icon }) {
  return (
    <div className="template-thumb">
      <div className="template-icon" style={{ backgroundColor: color }}>
        {icon}
      </div>
      <div className="template-info">
        <h4 className="template-name">{name}</h4>
        <p className="template-description">{description}</p>
      </div>
    </div>
  )
}

export default TemplateThumb
