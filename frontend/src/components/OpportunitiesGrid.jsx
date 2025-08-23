import React, { useState, useEffect } from 'react';

function OpportunitiesGrid() {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/data');
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const data = await response.json();
        setOpportunities(data.opportunities);
        setLoading(false);
      } catch (error) {
        setError(error);
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <div>
      <h2>Opportunities</h2>
      <div className="opportunities-grid">
        {opportunities.map((opp) => (
          <div key={opp.id} className="opportunity-card">
            <h3>{opp.title}</h3>
            <p>{opp.description}</p>
            <p>Value: {opp.value}€</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default OpportunitiesGrid;
