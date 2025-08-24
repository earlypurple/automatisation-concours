import React from 'react';

function PuppeteerSettings({ config, handleInputChange }) {
  return (
    <div>
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
    </div>
  );
}

export default PuppeteerSettings;
