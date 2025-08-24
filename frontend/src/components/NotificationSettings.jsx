import React from 'react';

function NotificationSettings({ config, handleInputChange }) {
  return (
    <div>
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
    </div>
  );
}

export default NotificationSettings;
