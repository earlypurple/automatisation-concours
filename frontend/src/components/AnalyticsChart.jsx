import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function AnalyticsChart() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/data');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setStats(data.stats);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return <div>Chargement des statistiques...</div>;
  }

  if (error) {
    return <div>Erreur lors du chargement des statistiques: {error}</div>;
  }

  if (!stats || !stats.opportunities_over_time || stats.opportunities_over_time.length === 0) {
    return <div>Aucune donnée disponible pour afficher le graphique.</div>;
  }

  return (
    <div style={{ width: '100%', height: 300 }}>
      <h2>Aperçu des Opportunités par Mois</h2>
      <ResponsiveContainer>
        <BarChart
          data={stats.opportunities_over_time}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="opportunités" fill="#8884d8" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default AnalyticsChart;
