import React from 'react';
import OpportunitiesGrid from '../components/OpportunitiesGrid';
import AnalyticsChart from '../components/AnalyticsChart';

function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <AnalyticsChart />
      <OpportunitiesGrid />
    </div>
  );
}

export default Dashboard;
