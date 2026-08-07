/* --- src/components/Settings/SettingSlider.jsx --- */
import React from 'react';

const SettingSlider = ({ 
  label, description, name, value, min, max, step = 1, unit = '', 
  handleChange, getSliderStyle 
}) => {
  const progressPct = ((value - min) / (max - min)) * 100;
  return (
    <div className="setting-item">
      <label>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{label}</span>
          <span className="value-badge">{value}{unit}</span>
        </div>
        {description && <span className="setting-desc">{description}</span>}
      </label>
      <input
        type="range"
        name={name}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleChange}
        style={getSliderStyle(name, progressPct)}
      />
    </div>
  );
};

export default SettingSlider;