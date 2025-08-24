import React from 'react';

function AutoParticipationSettings({ config, handleInputChange }) {
  return (
    <div>
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
    </div>
  );
}

export default AutoParticipationSettings;
