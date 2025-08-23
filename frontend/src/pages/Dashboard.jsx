import React from 'react';
import Layout from '../components/Layout';
import OpportunitiesGrid from '../components/OpportunitiesGrid';

function Dashboard() {
  return (
    <Layout>
      <h1>Dashboard</h1>
      <OpportunitiesGrid />
    </Layout>
  );
}

export default Dashboard;
