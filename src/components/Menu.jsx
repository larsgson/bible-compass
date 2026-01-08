import { useState } from 'react'
import './Menu.css'

function Menu({ onNavigate, currentView }) {
  const [isOpen, setIsOpen] = useState(false)

  const handleNavigation = (view) => {
    onNavigate(view)
    setIsOpen(false)
  }

  return (
    <nav className="menu">
      <div className="menu-container">
        <div className="menu-brand">
          <h2>Bible Compass</h2>
        </div>

        <button
          className="menu-toggle"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
        >
          <span className="hamburger"></span>
          <span className="hamburger"></span>
          <span className="hamburger"></span>
        </button>

        <ul className={`menu-items ${isOpen ? 'open' : ''}`}>
          <li>
            <button
              className={`menu-link ${currentView === 'main' ? 'active' : ''}`}
              onClick={() => handleNavigation('main')}
            >
              Home
            </button>
          </li>
          <li>
            <button
              className={`menu-link ${currentView === 'settings' ? 'active' : ''}`}
              onClick={() => handleNavigation('settings')}
            >
              Settings
            </button>
          </li>
        </ul>
      </div>
    </nav>
  )
}

export default Menu
