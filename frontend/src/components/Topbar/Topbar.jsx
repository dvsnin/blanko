import './Topbar.css'

function Topbar() {
  return (
    <div className="topbar">
      <div className="topbar-left">
        <h1 className="topbar-logo">Blanko</h1>
      </div>
      <div className="topbar-center">
        <input 
          type="search" 
          className="topbar-search" 
          placeholder="Search boards, templates..."
          aria-label="Search"
        />
      </div>
      <div className="topbar-right">
        <button className="topbar-button" aria-label="Notifications">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 2C7.243 2 5 4.243 5 7v3.586l-1.707 1.707A1 1 0 0 0 3 13v1a1 1 0 0 0 1 1h3.5a2.5 2.5 0 0 0 5 0H16a1 1 0 0 0 1-1v-1a1 1 0 0 0-.293-.707L15 10.586V7c0-2.757-2.243-5-5-5z" fill="currentColor"/>
          </svg>
        </button>
        <button className="topbar-button" aria-label="Settings">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" fill="currentColor"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M9 2a1 1 0 0 0-1 1v.153A6.95 6.95 0 0 0 6.153 4H6a1 1 0 0 0-1 1v1.847A6.95 6.95 0 0 0 3.847 8H3a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h.847A6.95 6.95 0 0 0 5 13.847V14a1 1 0 0 0 1 1h.153A6.95 6.95 0 0 0 8 16.153V17a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-.847A6.95 6.95 0 0 0 13.847 15H14a1 1 0 0 0 1-1v-1.847A6.95 6.95 0 0 0 16.153 11H17a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-.847A6.95 6.95 0 0 0 15 5.153V5a1 1 0 0 0-1-1h-1.847A6.95 6.95 0 0 0 11 3.153V3a1 1 0 0 0-1-1H9zm1 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" fill="currentColor"/>
          </svg>
        </button>
        <div className="topbar-avatar">
          <div className="avatar-circle">U</div>
        </div>
      </div>
    </div>
  )
}

export default Topbar
