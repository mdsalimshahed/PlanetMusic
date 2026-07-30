/* --- src/components/TranslationHeader.jsx --- */
import React, { useRef } from 'react';

const TranslationHeader = ({
  isTranslatingAll,
  translateProgress,
  handleTranslateAll,
  handleTranslateWithContext,
  handleRefreshWorkspace,
  handleExport,
  handleImportText,
  handleCancel,
  handleSave,
  cancelTranslationRef
}) => {
  const importFileInputRef = useRef(null);

  return (
    <div className="tw-header glass-panel">
      <div className="tw-header-actions full-width-actions">
        <button
          className={`tw-btn ${isTranslatingAll ? 'tw-btn-loading' : ''}`}
          onClick={handleTranslateAll}
        >
          {isTranslatingAll ? (
            <>
              <span className="tw-spinner"></span>
              <span>Stop Translation ({translateProgress.current}/{translateProgress.total})</span>
            </>
          ) : (
            'Translate All'
          )}
        </button>
        <button
          className={`tw-btn ${isTranslatingAll ? 'tw-btn-loading' : ''}`}
          onClick={handleTranslateWithContext}
          style={{ background: 'rgba(179, 136, 235, 0.2)', borderColor: 'var(--accent)', color: 'var(--accent)' }}
        >
          Translate with Context
        </button>
        <button
          className="tw-btn"
          onClick={handleRefreshWorkspace}
          disabled={isTranslatingAll}
          title="Wipe all translation and transliteration fields"
          style={{ background: 'rgba(250, 36, 60, 0.15)', borderColor: 'rgba(250, 36, 60, 0.3)', color: '#FA243C' }}
        >
          Refresh Lyrics
        </button>

        <button className="tw-btn" onClick={handleExport} disabled={isTranslatingAll}>
          Export Text
        </button>

        <input
          type="file"
          accept=".txt,text/plain"
          ref={importFileInputRef}
          style={{ display: 'none' }}
          onChange={handleImportText}
        />
        <button className="tw-btn" onClick={() => importFileInputRef.current?.click()} disabled={isTranslatingAll}>
          Import Text
        </button>

        <div className="tw-header-spacer"></div>
        <button className="tw-btn tw-btn-cancel" onClick={handleCancel}>Cancel</button>
        <button
          className="tw-btn tw-btn-save"
          onClick={() => handleSave(cancelTranslationRef)}
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default TranslationHeader;