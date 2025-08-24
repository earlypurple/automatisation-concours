import React from 'react';

function FilterSettings({ config, handleInputChange }) {
  return (
    <div>
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
    </div>
  );
}

export default FilterSettings;
