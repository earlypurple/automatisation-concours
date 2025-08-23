import React, { useState } from 'react';
import Layout from '../components/Layout';
import GeneralSettings from '../components/GeneralSettings';
import ProfilesSettings from '../components/ProfilesSettings';
import ProxiesSettings from '../components/ProxiesSettings';
import '../App.css';

function Settings() {
  const [activeTab, setActiveTab] = useState('general');

  return (
    <Layout>
      <h1>Settings</h1>
      <div className="tabs">
        <button onClick={() => setActiveTab('general')} className={activeTab === 'general' ? 'active' : ''}>General</button>
        <button onClick={() => setActiveTab('profiles')} className={activeTab === 'profiles' ? 'active' : ''}>Profiles</button>
        <button onClick={() => setActiveTab('proxies')} className={activeTab === 'proxies' ? 'active' : ''}>Proxies</button>
      </div>
      <div className="tab-content">
        {activeTab === 'general' && <GeneralSettings />}
        {activeTab === 'profiles' && <ProfilesSettings />}
        {activeTab === 'proxies' && <ProxiesSettings />}
      </div>
    </Layout>
  );
}

export default Settings;
