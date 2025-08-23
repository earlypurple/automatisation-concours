import React from 'react';
import Layout from '../components/Layout';
import OpportunitiesGrid from '../components/OpportunitiesGrid';
import AnalyticsChart from '../components/AnalyticsChart';

function Dashboard() {
  return (
    <Layout>
      <h1>Dashboard</h1>
      <AnalyticsChart />
      <OpportunitiesGrid />
    </Layout>
  );
}

export default Dashboard;
