/* --- src/components/Settings/SettingToggle.jsx --- */
import React from 'react';

const SettingToggle = ({ label, description, name, checked, handleChange }) => {
  return (
    <div className="setting-item toggle-item">
      <label>
        <span>{label}</span>
        {description && <span className="setting-desc">{description}</span>}
      </label>
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={handleChange}
      />
    </div>
  );
};

export default SettingToggle;