import React from 'react';

function EmailHandlerSettings({ config, handleInputChange }) {
  return (
    <div>
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
    </div>
  );
}

export default EmailHandlerSettings;
