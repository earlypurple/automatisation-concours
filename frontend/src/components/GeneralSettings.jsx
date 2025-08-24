import React, { useState, useEffect } from 'react';
import ScrapingSettings from './ScrapingSettings';
import ServerSettings from './ServerSettings';
import NotificationSettings from './NotificationSettings';
import FilterSettings from './FilterSettings';
import AutoParticipationSettings from './AutoParticipationSettings';
import PuppeteerSettings from './PuppeteerSettings';
import ProxiesSettings from './ProxiesSettings';
import CaptchaSolverSettings from './CaptchaSolverSettings';
import EmailHandlerSettings from './EmailHandlerSettings';
import ExportSettings from './ExportSettings';

function GeneralSettings() {
  const [config, setConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/config')
      .then(res => {
        if (!res.ok) {
          throw new Error('Network response was not ok');
        }
        return res.json();
      })
      .then(data => {
        setConfig(data);
        setIsLoading(false);
      })
      .catch(error => {
        setError(error);
        setIsLoading(false);
      });
  }, []);

  const handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    const keys = name.split('.');
    const val = type === 'checkbox' ? checked : value;

    setConfig(prevConfig => {
      const newConfig = JSON.parse(JSON.stringify(prevConfig)); // Deep copy
      let temp = newConfig;
      for (let i = 0; i < keys.length - 1; i++) {
        temp = temp[keys[i]];
      }
      temp[keys[keys.length - 1]] = val;
      return newConfig;
    });
  };

  const handleSave = () => {
    fetch('/api/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    })
    .then(res => {
      if (!res.ok) {
        throw new Error('Failed to save config');
      }
      alert('Settings saved successfully!');
    })
    .catch(error => {
      alert(`Error saving settings: ${error.message}`);
    });
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <div>
      <h2>General Settings</h2>
      {config && (
        <form>
          <ScrapingSettings config={config} handleInputChange={handleInputChange} />
          <ServerSettings config={config} handleInputChange={handleInputChange} />
          <NotificationSettings config={config} handleInputChange={handleInputChange} />
          <FilterSettings config={config} handleInputChange={handleInputChange} />
          <AutoParticipationSettings config={config} handleInputChange={handleInputChange} />
          <PuppeteerSettings config={config} handleInputChange={handleInputChange} />
          <ProxiesSettings config={config} handleInputChange={handleInputChange} />
          <CaptchaSolverSettings config={config} handleInputChange={handleInputChange} />
          <EmailHandlerSettings config={config} handleInputChange={handleInputChange} />
          <ExportSettings config={config} handleInputChange={handleInputChange} />

          <button type="button" onClick={handleSave}>
            Save Settings
          </button>
        </form>
      )}
    </div>
  );
}

export default GeneralSettings;
