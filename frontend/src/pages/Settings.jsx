import React, { useState, useEffect } from 'react';
import GeneralSettings from '../components/GeneralSettings';
import ServerSettings from '../components/ServerSettings';
import ScrapingSettings from '../components/ScrapingSettings';
import FilterSettings from '../components/FilterSettings';
import AutoParticipationSettings from '../components/AutoParticipationSettings';
import NotificationSettings from '../components/NotificationSettings';
import EmailHandlerSettings from '../components/EmailHandlerSettings';
import ProfilesSettings from '../components/ProfilesSettings';
import ProxiesSettings from '../components/ProxiesSettings';
import CaptchaSolverSettings from '../components/CaptchaSolverSettings';
import PuppeteerSettings from '../components/PuppeteerSettings';
import ExportSettings from '../components/ExportSettings';

function Settings() {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => setConfig(data));
  }, []);

  const handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    const [section, key] = name.split('.');
    const newValue = type === 'checkbox' ? checked : value;

    setConfig(prevConfig => ({
      ...prevConfig,
      [section]: {
        ...prevConfig[section],
        [key]: newValue,
      },
    }));
  };

  if (!config) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>Settings</h1>
      <GeneralSettings config={config} handleInputChange={handleInputChange} />
      <ServerSettings config={config} handleInputChange={handleInputChange} />
      <ScrapingSettings config={config} handleInputChange={handleInputChange} />
      <FilterSettings config={config} handleInputChange={handleInputChange} />
      <AutoParticipationSettings config={config} handleInputChange={handleInputChange} />
      <NotificationSettings config={config} handleInputChange={handleInputChange} />
      <EmailHandlerSettings config={config} handleInputChange={handleInputChange} />
      <ProfilesSettings config={config} handleInputChange={handleInputChange} />
      <ProxiesSettings config={config} handleInputChange={handleInputChange} />
      <CaptchaSolverSettings config={config} handleInputChange={handleInputChange} />
      <PuppeteerSettings config={config} handleInputChange={handleInputChange} />
      <ExportSettings config={config} handleInputChange={handleInputChange} />
    </div>
  );
}

export default Settings;
