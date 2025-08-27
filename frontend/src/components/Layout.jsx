import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import './Layout.css';

function Layout({ children }) {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="layout">
      <button className="menu-button" onClick={toggleSidebar}>
        &#9776; {/* Hamburger Icon */}
      </button>
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>Dashboard Pro</h2>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" end onClick={() => setSidebarOpen(false)}>Dashboard</NavLink>
          <NavLink to="/settings" onClick={() => setSidebarOpen(false)}>Settings</NavLink>
        </nav>
      </aside>
      <main className="content">
        {children}
      </main>
    </div>
  );
}

export default Layout;
