import React, { useState, useEffect } from 'react';

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
          <h3>Scraping</h3>
          <label>
            Interval (minutes):
            <input
              type="number"
              name="scraping.interval_minutes"
              value={config.scraping.interval_minutes}
              onChange={handleInputChange}
            />
          </label>
          <br />
          <label>
            Start Time:
            <input
              type="text"
              name="scraping.start_time"
              value={config.scraping.start_time}
              onChange={handleInputChange}
            />
          </label>
          <br />
          <label>
            Max Threads:
            <input
              type="number"
              name="scraping.max_threads"
              value={config.scraping.max_threads}
              onChange={handleInputChange}
            />
          </label>
          <br />
          <label>
            Timeout:
            <input
              type="number"
              name="scraping.timeout"
              value={config.scraping.timeout}
              onChange={handleInputChange}
            />
          </label>
          <br />
          <h3>Server</h3>
          <label>
            Port:
            <input
              type="number"
              name="server.port"
              value={config.server.port}
              onChange={handleInputChange}
            />
          </label>
          <br />
          <label>
            Host:
            <input
              type="text"
              name="server.host"
              value={config.server.host}
              onChange={handleInputChange}
            />
          </label>
          <br />
          <label>
            Enable API:
            <input
              type="checkbox"
              name="server.enable_api"
              checked={config.server.enable_api}
              onChange={handleInputChange}
            />
          </label>
          <br />
          <label>
            CORS Enabled:
            <input
              type="checkbox"
              name="server.cors_enabled"
              checked={config.server.cors_enabled}
              onChange={handleInputChange}
            />
          </label>
          <br />
          <h3>Notifications</h3>
          <label>
            Desktop:
            <input
              type="checkbox"
              name="notifications.desktop"
              checked={config.notifications.desktop}
              onChange={handleInputChange}
            />
          </label>
          <br />
          <label>
            Browser:
            <input
              type="checkbox"
              name="notifications.browser"
              checked={config.notifications.browser}
              onChange={handleInputChange}
            />
          </label>
          <br />
          <label>
            Min Priority:
            <input
              type="number"
              name="notifications.min_priority"
              value={config.notifications.min_priority}
              onChange={handleInputChange}
            />
          </label>
          <br />
          <h4>Telegram</h4>
          <label>
            Enabled:
            <input
              type="checkbox"
              name="notifications.telegram.enabled"
              checked={config.notifications.telegram.enabled}
              onChange={handleInputChange}
            />
          </label>
          <br />
          <label>
            Bot Token:
            <input
              type="text"
              name="notifications.telegram.bot_token"
              value={config.notifications.telegram.bot_token}
              onChange={handleInputChange}
            />
          </label>
          <br />
          <label>
            Chat ID:
            <input
              type="text"
              name="notifications.telegram.chat_id"
              value={config.notifications.telegram.chat_id}
              onChange={handleInputChange}
            />
          </label>
          <br />
          <h3>Filters</h3>
          <label>
            Min Value:
            <input
              type="number"
              name="filters.min_value"
              value={config.filters.min_value}
              onChange={handleInputChange}
            />
          </label>
          <br />
          <label>
            Categories:
            <input
              type="text"
              name="filters.categories"
              value={config.filters.categories.join(',')}
              onChange={(e) => handleInputChange({ target: { name: e.target.name, value: e.target.value.split(',') } })}
            />
          </label>
          <br />
          <label>
            Excluded Domains:
            <input
              type="text"
              name="filters.excluded_domains"
              value={config.filters.excluded_domains.join(',')}
              onChange={(e) => handleInputChange({ target: { name: e.target.name, value: e.target.value.split(',') } })}
            />
          </label>
          <br />

          <h3>Auto Participation</h3>
          <label>
            Enabled:
            <input
              type="checkbox"
              name="auto__participation.enabled"
              checked={config.auto__participation.enabled}
              onChange={handleInputChange}
            />
          </label>
          <br />
          <label>
            Max Per Day:
            <input
              type="number"
              name="auto__participation.max_per_day"
              value={config.auto__participation.max_per_day}
              onChange={handleInputChange}
            />
          </label>
          <br />
          <label>
            Safe Mode:
            <input
              type="checkbox"
              name="auto__participation.safe_mode"
              checked={config.auto__participation.safe_mode}
              onChange={handleInputChange}
            />
          </label>
          <br />

          <h3>Puppeteer</h3>
          <label>
            Headless:
            <input
              type="checkbox"
              name="puppeteer.headless"
              checked={config.puppeteer.headless}
              onChange={handleInputChange}
            />
          </label>
          <br />
          <label>
            Log Level:
            <input
              type="text"
              name="puppeteer.log_level"
              value={config.puppeteer.log_level}
              onChange={handleInputChange}
            />
          </label>
          <br />

          <h3>Proxies</h3>
          <label>
            Enabled:
            <input
              type="checkbox"
              name="proxies.enabled"
              checked={config.proxies.enabled}
              onChange={handleInputChange}
            />
          </label>
          <br />
          <label>
            Rotation Mode:
            <input
              type="text"
              name="proxies.rotation_mode"
              value={config.proxies.rotation_mode}
              onChange={handleInputChange}
            />
          </label>
          <br />

          <h3>Captcha Solver</h3>
          <label>
            Enabled:
            <input
              type="checkbox"
              name="captcha_solver.enabled"
              checked={config.captcha_solver.enabled}
              onChange={handleInputChange}
            />
          </label>
          <br />
          <label>
            Provider:
            <input
              type="text"
              name="captcha_solver.provider"
              value={config.captcha_solver.provider}
              onChange={handleInputChange}
            />
          </label>
          <br />

          <h3>Email Handler</h3>
          <label>
            Enabled:
            <input
              type="checkbox"
              name="email_handler.enabled"
              checked={config.email_handler.enabled}
              onChange={handleInputChange}
            />
          </label>
          <br />
          <label>
            Check Interval (minutes):
            <input
              type="number"
              name="email_handler.check_interval_minutes"
              value={config.email_handler.check_interval_minutes}
              onChange={handleInputChange}
            />
          </label>
          <br />

          <h3>Export</h3>
          <label>
            Auto Backup:
            <input
              type="checkbox"
              name="export.auto_backup"
              checked={config.export.auto_backup}
              onChange={handleInputChange}
            />
          </label>
          <br />
          <label>
            Backup Interval (hours):
            <input
              type="number"
              name="export.backup_interval_hours"
              value={config.export.backup_interval_hours}
              onChange={handleInputChange}
            />
          </label>
          <br />
          <label>
            Formats:
            <input
              type="text"
              name="export.formats"
              value={config.export.formats.join(',')}
              onChange={(e) => handleInputChange({ target: { name: e.target.name, value: e.target.value.split(',') } })}
            />
          </label>
          <br />

          <button type="button" onClick={handleSave}>
            Save Settings
          </button>
        </form>
      )}
    </div>
  );
}

export default GeneralSettings;
