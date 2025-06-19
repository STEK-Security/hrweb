import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';
import LoginPage from './components/LoginPage';
import DashboardPage from './components/DashboardPage';
import EmployeeManagementPage from './components/EmployeeManagementPage';
import TeamManagementPage from './components/TeamManagementPage';
import PerformanceReviewPage from './components/PerformanceReviewPage';
import NotificationsPage from './components/NotificationsPage';
import ReportsPage from './components/ReportsPage';

function App() {
  return (
    <Router>
      <div>
        <nav>
          <ul>
            <li><Link to="/">Home (Dashboard)</Link></li>
            <li><Link to="/login">Login</Link></li>
            <li><Link to="/employees">Employee Management</Link></li>
            <li><Link to="/teams">Team Management</Link></li>
            <li><Link to="/reviews">Performance Reviews</Link></li>
            <li><Link to="/notifications">Notifications</Link></li>
            <li><Link to="/reports">Reports</Link></li>
          </ul>
        </nav>
        <hr />
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/employees" element={<EmployeeManagementPage />} />
          <Route path="/teams" element={<TeamManagementPage />} />
          <Route path="/reviews" element={<PerformanceReviewPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
