import React from 'react';

function ExportSettings({ config, handleInputChange }) {
  return (
    <div>
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
    </div>
  );
}

export default ExportSettings;
