import React from 'react';
import { NavLink } from 'react-router-dom';
import './Layout.css'; // We will create this file next

function Layout({ children }) {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Dashboard Pro</h2>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
      </aside>
      <main className="content">
        {children}
      </main>
    </div>
  );
}

export default Layout;
