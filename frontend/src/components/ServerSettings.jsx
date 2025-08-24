import React from 'react';

function ServerSettings({ config, handleInputChange }) {
  return (
    <div>
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
    </div>
  );
}

export default ServerSettings;
