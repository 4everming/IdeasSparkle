import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import Library from './pages/Library';
import PaperViewer from './pages/PaperViewer';
import { useState } from 'react';

function App() {
  const location = useLocation();
  const isViewer = location.pathname.startsWith('/paper/');

  return (
    <div className="app-layout">
      {/* Sidebar Navigation */}
      <nav className="nav-sidebar">
        <div className="nav-logo">
          <div className="nav-logo-icon">✦</div>
          <div className="nav-logo-text">IdeasSparkle</div>
        </div>
        <ul className="nav-links">
          <li>
            <NavLink
              to="/"
              className={({ isActive }) => `nav-link ${isActive && !isViewer ? 'active' : ''}`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
              <span>论文库</span>
            </NavLink>
          </li>
          {isViewer && (
            <li>
              <NavLink to={location.pathname} className="nav-link active">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                <span>阅读器</span>
              </NavLink>
            </li>
          )}
        </ul>
        <div style={{ flex: 1 }} />
        <div style={{ padding: '12px 8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          IdeasSparkle v1.0
        </div>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Library />} />
          <Route path="/paper/:id" element={<PaperViewer />} />
        </Routes>
      </main>

      {/* Toast Container */}
      <div className="toast-container" id="toast-container"></div>
    </div>
  );
}

export default App;
