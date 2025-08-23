import React, { useState, useEffect } from 'react';

function ProxiesSettings() {
  const [proxies, setProxies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [proxyInput, setProxyInput] = useState('');

  const fetchProxies = () => {
    setIsLoading(true);
    fetch('/api/proxies')
      .then(res => res.json())
      .then(data => {
        setProxies(data);
        setIsLoading(false);
      })
      .catch(error => {
        setError(error);
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchProxies();
  }, []);

  const handleAddProxy = () => {
    if (!proxyInput.trim()) {
      alert('Proxy URL cannot be empty.');
      return;
    }
    fetch('/api/proxies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proxy_url: proxyInput })
    })
    .then(res => {
      if (!res.ok) throw new Error('Failed to add proxy');
      setProxyInput('');
      fetchProxies();
    })
    .catch(error => alert(`Error: ${error.message}`));
  };

  const handleDeleteProxy = (proxyUrl) => {
    if (window.confirm(`Are you sure you want to delete the proxy "${proxyUrl}"?`)) {
      fetch('/api/proxies', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proxy_url: proxyUrl })
      })
      .then(res => {
        if (!res.ok) throw new Error('Failed to delete proxy');
        fetchProxies();
      })
      .catch(error => alert(`Error: ${error.message}`));
    }
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h2>Proxies</h2>
      <div>
        <input
          type="text"
          value={proxyInput}
          onChange={(e) => setProxyInput(e.target.value)}
          placeholder="Enter proxy URL"
        />
        <button onClick={handleAddProxy}>Add Proxy</button>
      </div>
      <ul>
        {proxies.map((proxy, index) => (
          <li key={index}>
            {proxy}
            <button onClick={() => handleDeleteProxy(proxy)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ProxiesSettings;
