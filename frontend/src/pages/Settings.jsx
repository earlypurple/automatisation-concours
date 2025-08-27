import React from 'react';
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
  return (
    <div>
      <h1>Settings</h1>
      <GeneralSettings />
      <ServerSettings />
      <ScrapingSettings />
      <FilterSettings />
      <AutoParticipationSettings />
      <NotificationSettings />
      <EmailHandlerSettings />
      <ProfilesSettings />
      <ProxiesSettings />
      <CaptchaSolverSettings />
      <PuppeteerSettings />
      <ExportSettings />
    </div>
  );
}

export default Settings;
