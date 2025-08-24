import React from 'react';

function ScrapingSettings({ config, handleInputChange }) {
  return (
    <div>
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
    </div>
  );
}

export default ScrapingSettings;
