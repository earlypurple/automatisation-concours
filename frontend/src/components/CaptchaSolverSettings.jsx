import React from 'react';

function CaptchaSolverSettings({ config, handleInputChange }) {
  return (
    <div>
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
    </div>
  );
}

export default CaptchaSolverSettings;
