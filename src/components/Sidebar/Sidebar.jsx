import React from 'react';
import {
  FiHome,
  FiType,
  FiFileText,
  FiBookOpen,
  FiClock,
  FiSettings,
  FiVolume2,
  FiSun,
  FiMoon,
  FiX,
} from 'react-icons/fi';
import './Sidebar.css';

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: FiHome },
  { id: 'tts', label: 'Text to Speech', icon: FiType },
  { id: 'pdf', label: 'PDF Reader', icon: FiFileText },
  { id: 'document', label: 'Document Reader', icon: FiBookOpen },
  { id: 'history', label: 'Reading History', icon: FiClock },
  { id: 'settings', label: 'Settings', icon: FiSettings },
];

export default function Sidebar({
  activeTab,
  onSelectTab,
  theme,
  onToggleTheme,
  isMobileOpen,
  onCloseMobile,
  historyCount = 0,
}) {
  return (
    <>
      {isMobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}
      <aside
        className={`vr-sidebar ${isMobileOpen ? 'is-open' : ''}`}
        aria-label="Primary Navigation"
      >
        <div className="sidebar-header">
          <button
            type="button"
            className="sidebar-brand"
            onClick={() => {
              onSelectTab('home');
              onCloseMobile();
            }}
          >
            <span className="brand-icon" aria-hidden="true">
              <FiVolume2 />
            </span>
            <span className="brand-text">
              <strong>VoiceReader</strong>
              <small>Smart Audio Studio</small>
            </span>
          </button>
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
          >
            <FiX />
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`sidebar-nav-item ${isActive ? 'is-active' : ''}`}
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="nav-icon" aria-hidden="true" />
                <span className="nav-label">{item.label}</span>
                {item.id === 'history' && historyCount > 0 && (
                  <span className="nav-pill">{historyCount}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <>
                <FiSun aria-hidden="true" />
                <span>Light Mode</span>
              </>
            ) : (
              <>
                <FiMoon aria-hidden="true" />
                <span>Dark Mode</span>
              </>
            )}
          </button>
          <div className="sidebar-shortcuts-hint">
            <span>Shortcuts:</span> Space (Play/Pause), ← / → (Sentence)
          </div>
        </div>
      </aside>
    </>
  );
}

