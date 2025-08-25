import React, { useState, useEffect } from 'react';

function OpportunitiesGrid() {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('score');

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/data');
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const data = await response.json();
        console.log("Data from API:", data);
        setOpportunities(data.opportunities);
        console.log("Opportunities state updated:", data.opportunities);
        setLoading(false);
      } catch (error) {
        setError(error);
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const filteredAndSortedOpportunities = opportunities
    .filter(opp => opp.title.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortOrder === 'value') {
        return b.value - a.value;
      }
      if (sortOrder === 'priority') {
        return b.priority - a.priority;
      }
      // Default sort by score
      return b.score - a.score;
    });

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <div>
      <h2>Opportunities</h2>
      <div className="filters">
        <input
          type="text"
          placeholder="Search by title..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
          <option value="score">Sort by Score</option>
          <option value="value">Sort by Value</option>
          <option value="priority">Sort by Priority</option>
        </select>
      </div>
      <div className="opportunities-grid">
        {filteredAndSortedOpportunities.map((opp) => (
          <div key={opp.id} className="opportunity-card">
            <h3>{opp.title}</h3>
            <p>{opp.description}</p>
            <p>Value: {opp.value}€</p>
            <p>Priority: {opp.priority}</p>
            <p>Score: {opp.score}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default OpportunitiesGrid;
