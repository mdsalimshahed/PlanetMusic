/* --- src/components/Settings/PurgeCard.jsx --- */
import React from 'react';

const PurgeCard = ({ showPurgeConfirm, setShowPurgeConfirm, handlePurgeAllData }) => {
  return (
    <div className="settings-card glass-panel purge-card">
      <h3 style={{ color: '#FA243C' }}>Danger Zone</h3>
      {!showPurgeConfirm ? (
        <button className="purge-action-btn" onClick={() => setShowPurgeConfirm(true)}>
          Purge All Local Data
        </button>
      ) : (
        <div className="purge-warning-box">
          <h4>Are you absolutely sure?</h4>
          <p>This action will completely wipe your Vault, all saved songs, custom lyrics, audio files in IndexedDB, and application settings.</p>
          <p className="auto-backup-note">  A backup JSON file will be automatically downloaded to your device before the purge triggers.</p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button 
              className="purge-action-btn" 
              style={{ flex: 1, background: 'rgba(255, 255, 255, 0.1)', color: 'white', borderColor: 'rgba(255, 255, 255, 0.2)' }}
              onClick={() => setShowPurgeConfirm(false)}
            >
              Cancel
            </button>
            <button 
              className="purge-action-btn" 
              style={{ flex: 1 }}
              onClick={handlePurgeAllData}
            >
              Confirm Purge
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurgeCard;